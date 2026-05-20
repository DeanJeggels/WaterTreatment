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

export default function Canvas() {
  const reactFlowInstance = useReactFlow();
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
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

      addNode(unitType, position);
    },
    [addNode, reactFlowInstance]
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
  }, [selectNode]);

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
