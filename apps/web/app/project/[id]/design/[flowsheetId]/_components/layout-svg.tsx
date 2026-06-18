'use client';

import type { EngineeringObject, PlantLayout } from '@repo/object-model';

/**
 * LayoutSvg (T5.2) — PURE render of a persisted plant layout. Reads
 * geometry/placement verbatim and computes nothing engineering: it only maps
 * site metres to SVG units (with a north-up Y flip) and draws shapes/labels.
 */
interface Props {
  objects: EngineeringObject[];
  layout: PlantLayout;
}

const PAD = 6; // metres of margin around the plant

const MEDIUM_COLOR: Record<string, string> = {
  water: '#2563eb',
  sludge: '#92400e',
  air: '#0ea5e9',
  chemical: '#16a34a',
  power: '#eab308',
  signal: '#a855f7',
};

const ZONE_FILL: Record<string, string> = {
  process: '#dbeafe',
  sludge: '#fef3c7',
  chemical: '#dcfce7',
  electrical: '#fee2e2',
  blower: '#e0e7ff',
  headworks: '#f1f5f9',
};

export function LayoutSvg({ objects, layout }: Props) {
  const xs: number[] = [];
  const ys: number[] = [];
  const push = (x: number, y: number) => {
    xs.push(x);
    ys.push(y);
  };
  for (const o of objects) {
    const hx = o.geometry.footprint.lengthM / 2;
    const hy = o.geometry.footprint.widthM / 2;
    push(o.placement.location.x - hx, o.placement.location.y - hy);
    push(o.placement.location.x + hx, o.placement.location.y + hy);
  }
  for (const p of layout.siteBoundary) push(p.x, p.y);
  for (const c of layout.corridors) for (const p of c.polygon) push(p.x, p.y);

  if (xs.length === 0) {
    return <div className="text-sm text-muted-foreground">No layout to display.</div>;
  }

  const minX = Math.min(...xs) - PAD;
  const maxX = Math.max(...xs) + PAD;
  const minY = Math.min(...ys) - PAD;
  const maxY = Math.max(...ys) + PAD;
  const W = maxX - minX;
  const H = maxY - minY;

  const sx = (x: number) => x - minX;
  const sy = (y: number) => maxY - y; // north-up flip
  const poly = (pts: { x: number; y: number }[]) => pts.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ');
  const fontSize = Math.min(6, Math.max(1.8, Math.min(W, H) / 55));
  const lineHeight = fontSize * 1.15;

  // Stagger labels within each band (row) so adjacent small units don't collide.
  const labelLevel = new Map<string, number>();
  const rows = new Map<number, EngineeringObject[]>();
  for (const o of objects) {
    const k = Math.round(o.placement.location.y / 6);
    (rows.get(k) ?? rows.set(k, []).get(k)!).push(o);
  }
  for (const arr of rows.values()) {
    arr.sort((a, b) => a.placement.location.x - b.placement.location.x);
    arr.forEach((o, i) => labelLevel.set(o.id, i % 2));
  }

  const hasViolation = layout.violations.some((v) => v.severity === 'error');

  return (
    <div className="w-full overflow-hidden rounded-md border border-border bg-white">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Plant layout">
        {/* site boundary */}
        <polygon points={poly(layout.siteBoundary)} fill="none" stroke="#94a3b8" strokeWidth={W / 400} strokeDasharray={`${W / 80} ${W / 160}`} />

        {/* corridors */}
        {layout.corridors.map((c) => (
          <polygon key={c.id} points={poly(c.polygon)} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={W / 600} />
        ))}

        {/* bunds */}
        {layout.bunds.map((b) => (
          <polygon key={b.id} points={poly(b.polygon)} fill="none" stroke="#16a34a" strokeWidth={W / 500} strokeDasharray={`${W / 120} ${W / 240}`} />
        ))}

        {/* pipe routes */}
        {layout.pipeRoutes.map((pr) => (
          <polyline
            key={pr.id}
            points={poly(pr.points)}
            fill="none"
            stroke={MEDIUM_COLOR[pr.medium] ?? '#64748b'}
            strokeWidth={W / 500}
          />
        ))}

        {/* objects */}
        {objects.map((o) => {
          const { x, y } = o.placement.location;
          const fill = ZONE_FILL[o.placement.zone ?? 'process'] ?? '#e2e8f0';
          const stroke = '#334155';
          const sw = W / 500;
          const mnemonic = o.tag.split('-')[0]; // short label; full tag on hover
          const halfH = o.geometry.footprint.widthM / 2;
          // label sits just below the unit, staggered one line for odd-ranked neighbours
          const labelY = sy(y) + halfH + lineHeight * (0.9 + (labelLevel.get(o.id) ?? 0));
          return (
            <g key={o.id}>
              <title>{`${o.tag} — ${o.label}`}</title>
              {o.geometry.shape === 'circle' && o.geometry.diameterM ? (
                <circle cx={sx(x)} cy={sy(y)} r={o.geometry.diameterM.value / 2} fill={fill} stroke={stroke} strokeWidth={sw} />
              ) : (
                <rect
                  x={sx(x - o.geometry.footprint.lengthM / 2)}
                  y={sy(y + o.geometry.footprint.widthM / 2)}
                  width={o.geometry.footprint.lengthM}
                  height={o.geometry.footprint.widthM}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={sw}
                />
              )}
              <text
                x={sx(x)}
                y={labelY}
                fontSize={fontSize}
                textAnchor="middle"
                fill="#0f172a"
                stroke="#ffffff"
                strokeWidth={fontSize / 6}
                paintOrder="stroke"
                style={{ pointerEvents: 'none' }}
              >
                {mnemonic}
              </text>
            </g>
          );
        })}

        {hasViolation && (
          <text x={W / 2} y={H - fontSize} fontSize={fontSize * 1.4} textAnchor="middle" fill="#dc2626" fontWeight="bold">
            ⚠ {layout.violations.find((v) => v.severity === 'error')!.code}
          </text>
        )}
      </svg>
    </div>
  );
}
