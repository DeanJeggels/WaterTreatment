'use client';

import { useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from './node-types';
import {
  useFlowsheetStore,
  type FlowsheetNode,
  type FlowsheetEdge,
} from '@/stores/flowsheet-store';
import { getRecycleEdgeIds } from '@/lib/recycle';
import type { UnitType } from '@repo/sim-engine';

/** Units that splice inline onto an existing stream instead of dropping as a loose box. */
const SPLICEABLE: Set<UnitType> = new Set(['chemical_dosing', 'uv_disinfection']);
/** Max distance (flow units) from drop point to an edge to count as an inline drop. */
const SPLICE_THRESHOLD = 40;

/** Shortest distance from point p to the line segment a→b. */
function distanceToSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export default function Canvas() {
  const reactFlowInstance = useReactFlow();
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    spliceNodeOntoEdge,
    selectNode,
    selectEdge,
  } = useFlowsheetStore();

  const recycleIds = useMemo(
    () => getRecycleEdgeIds(nodes, edges),
    [nodes, edges]
  );

  const displayEdges = useMemo(
    () =>
      edges.map((e) => {
        if (!recycleIds.has(e.id)) return e;
        const ratio =
          (e.data as { recycleRatio?: number } | undefined)?.recycleRatio ?? 4;
        return {
          ...e,
          animated: true,
          label: `↻ ${ratio}×`,
          style: { ...e.style, stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '6 4' },
          labelStyle: { fill: '#f59e0b', fontWeight: 600, fontSize: 11 },
          labelBgStyle: { fill: 'var(--card)', fillOpacity: 0.9 },
        };
      }),
    [edges, recycleIds]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const unitType = event.dataTransfer.getData('application/aquasim-unit-type') as UnitType;
      if (!unitType) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      if (SPLICEABLE.has(unitType)) {
        const centerOf = (nodeId: string) => {
          const n = reactFlowInstance.getNode(nodeId);
          if (!n) return null;
          const w = n.measured?.width ?? 150;
          const h = n.measured?.height ?? 80;
          return { x: n.position.x + w / 2, y: n.position.y + h / 2 };
        };
        let nearest: { id: string; dist: number } | null = null;
        for (const e of edges) {
          const a = centerOf(e.source);
          const b = centerOf(e.target);
          if (!a || !b) continue;
          const d = distanceToSegment(position, a, b);
          if (!nearest || d < nearest.dist) nearest = { id: e.id, dist: d };
        }
        if (nearest && nearest.dist <= SPLICE_THRESHOLD) {
          spliceNodeOntoEdge(unitType, position, nearest.id);
          return;
        }
      }

      addNode(unitType, position);
    },
    [addNode, spliceNodeOntoEdge, edges, reactFlowInstance]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: FlowsheetNode) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: FlowsheetEdge) => {
      selectEdge(edge.id);
    },
    [selectEdge]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
    selectEdge(null);
  }, [selectNode, selectEdge]);

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-background"
        defaultEdgeOptions={{
          animated: true,
          type: 'smoothstep',
          style: { strokeWidth: 2 },
        }}
      >
        <Controls className="!bg-card !border-border !text-foreground" />
        <MiniMap
          className="!bg-card !border-border"
          nodeColor="var(--primary)"
          maskColor="var(--muted)"
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--canvas-dots)"
        />
      </ReactFlow>
    </div>
  );
}
