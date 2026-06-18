'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { EngineeringObject, PlantLayout } from '@repo/object-model';

/**
 * PlantViewer3D — a Three.js viewer that EXTRUDES the DesignPackage into 3D.
 * Pure consumer of objects[]: each object becomes a box (rectangle) or cylinder
 * (circle) sized by geometry.footprint × heightM/diameterM, placed at
 * placement.location with rotationDeg, coloured by zone. This is the
 * "JSON = 3D source of truth" seam realised — no engineering math here.
 */
interface Props {
  objects: EngineeringObject[];
  layout: PlantLayout;
}

const ZONE_COLOR: Record<string, number> = {
  process: 0x6b8fd4,
  sludge: 0xc9a227,
  chemical: 0x3fa563,
  electrical: 0xd45555,
  blower: 0x7b86d9,
  headworks: 0x90a0b3,
};

const LABEL_CSS =
  'font:600 10px ui-monospace,monospace;color:#cdd6e0;background:rgba(10,13,18,.78);' +
  'border:1px solid #2d3441;border-radius:3px;padding:2px 6px;white-space:nowrap;transform:translateY(-6px)';

function heightOf(o: EngineeringObject): number {
  return o.geometry.heightM?.value ?? o.geometry.diameterM?.value ?? 3;
}

export function PlantViewer3D({ objects, layout }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<{ reset: () => void; setLabels: (v: boolean) => void } | null>(null);
  const [labelsOn, setLabelsOn] = useState(true);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || objects.length === 0) return;

    const width = mount.clientWidth || 800;
    const height = mount.clientHeight || 520;

    // Recentre on the plant footprint so it frames nicely.
    const cx = objects.reduce((s, o) => s + o.placement.location.x, 0) / objects.length;
    const cy = objects.reduce((s, o) => s + o.placement.location.y, 0) / objects.length;
    const mapX = (x: number) => x - cx;
    const mapZ = (y: number) => -(y - cy);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d12);

    // ---- lights ----
    scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x202830, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(120, 200, 80);
    scene.add(sun);

    // ---- ground grid ----
    let span = 60;
    for (const o of objects) {
      span = Math.max(span, Math.abs(mapX(o.placement.location.x)) + o.geometry.footprint.lengthM);
      span = Math.max(span, Math.abs(mapZ(o.placement.location.y)) + o.geometry.footprint.widthM);
    }
    const grid = new THREE.GridHelper(Math.ceil(span * 2.4), Math.ceil(span / 5), 0x223040, 0x161d28);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.5;
    scene.add(grid);

    // ---- site boundary ----
    if (layout.siteBoundary.length > 2) {
      const pts = layout.siteBoundary.map((p) => new THREE.Vector3(mapX(p.x), 0.1, mapZ(p.y)));
      pts.push(pts[0]!.clone());
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x3d4651 }),
      );
      scene.add(line);
    }

    // ---- objects ----
    const labels: CSS2DObject[] = [];
    for (const o of objects) {
      const h = heightOf(o);
      const baseZ = o.placement.location.z;
      const color = ZONE_COLOR[o.placement.zone ?? 'process'] ?? 0x8090a0;

      let geom: THREE.BufferGeometry;
      if (o.geometry.shape === 'circle' && o.geometry.diameterM) {
        geom = new THREE.CylinderGeometry(o.geometry.diameterM.value / 2, o.geometry.diameterM.value / 2, h, 40);
      } else {
        geom = new THREE.BoxGeometry(o.geometry.footprint.lengthM, h, o.geometry.footprint.widthM);
      }

      const mesh = new THREE.Mesh(
        geom,
        new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.12 }),
      );
      mesh.position.set(mapX(o.placement.location.x), baseZ + h / 2, mapZ(o.placement.location.y));
      mesh.rotation.y = THREE.MathUtils.degToRad(o.placement.rotationDeg);
      scene.add(mesh);

      // crisp edges
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geom),
        new THREE.LineBasicMaterial({ color: 0x0a0d12, transparent: true, opacity: 0.5 }),
      );
      edges.position.copy(mesh.position);
      edges.rotation.copy(mesh.rotation);
      scene.add(edges);

      // tag label
      const div = document.createElement('div');
      div.style.cssText = LABEL_CSS;
      div.textContent = o.tag;
      div.title = o.label;
      const label = new CSS2DObject(div);
      label.position.set(mesh.position.x, baseZ + h + 1.5, mesh.position.z);
      scene.add(label);
      labels.push(label);
    }

    // ---- renderers ----
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    mount.appendChild(labelRenderer.domElement);

    // ---- camera + controls ----
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.5, 8000);
    const dist = span * 1.7 + 40;
    const home = new THREE.Vector3(dist * 0.75, dist * 0.7, dist * 0.85);
    camera.position.copy(home);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);
    controls.maxPolarAngle = Math.PI / 2.05; // don't go under the ground

    apiRef.current = {
      reset: () => {
        camera.position.copy(home);
        controls.target.set(0, 0, 0);
        controls.update();
      },
      setLabels: (v: boolean) => labels.forEach((l) => (l.visible = v)),
    };

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth || width;
      const hgt = mount.clientHeight || height;
      camera.aspect = w / hgt;
      camera.updateProjectionMatrix();
      renderer.setSize(w, hgt);
      labelRenderer.setSize(w, hgt);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Line) {
          obj.geometry.dispose();
          const m = obj.material as THREE.Material | THREE.Material[];
          Array.isArray(m) ? m.forEach((x) => x.dispose()) : m.dispose();
        }
      });
      labels.forEach((l) => l.element.remove());
      renderer.domElement.remove();
      labelRenderer.domElement.remove();
      apiRef.current = null;
    };
  }, [objects, layout]);

  const zonesPresent = Array.from(new Set(objects.map((o) => o.placement.zone ?? 'process')));

  return (
    <div className="relative overflow-hidden rounded-md border border-border" style={{ background: '#0a0d12' }}>
      <div ref={mountRef} className="relative h-[520px] w-full" />

      {/* controls */}
      <div className="absolute right-3 top-3 flex gap-2">
        <button
          onClick={() => {
            const v = !labelsOn;
            setLabelsOn(v);
            apiRef.current?.setLabels(v);
          }}
          className="rounded border border-[#2d3441] bg-[#161b22] px-2.5 py-1 font-mono text-[11px] text-[#8b949e] hover:text-[#58a6ff]"
        >
          {labelsOn ? 'Labels on' : 'Labels off'}
        </button>
        <button
          onClick={() => apiRef.current?.reset()}
          className="rounded border border-[#2d3441] bg-[#161b22] px-2.5 py-1 font-mono text-[11px] text-[#8b949e] hover:text-[#58a6ff]"
        >
          Reset view
        </button>
      </div>

      {/* legend */}
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1 rounded border border-[#2d3441] bg-[#161b22]/80 px-3 py-2 font-mono text-[10px] text-[#8b949e] backdrop-blur">
        {zonesPresent.map((z) => (
          <span key={z} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: `#${(ZONE_COLOR[z] ?? 0x8090a0).toString(16).padStart(6, '0')}` }}
            />
            {z}
          </span>
        ))}
      </div>

      <div className="absolute bottom-3 right-3 font-mono text-[10px] text-[#5a6573]">
        drag to orbit · scroll to zoom · right-drag to pan
      </div>
    </div>
  );
}
