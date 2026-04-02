'use client';

import { useCallback, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useReactFlow,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import ProcessUnitNode from './custom-nodes/ProcessUnitNode';
import { useFlowsheetStore, type FlowsheetNode } from '@/stores/flowsheet-store';
import type { UnitType } from '@repo/sim-engine';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: NodeTypes = {
  processUnit: ProcessUnitNode as any,
};

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
  } = useFlowsheetStore();

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

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-background"
        defaultEdgeOptions={{
          animated: true,
          type: 'smoothstep',
          style: { stroke: '#94a3b8', strokeWidth: 2 },
        }}
      >
        <Controls className="!bg-card !border-border" />
        <MiniMap
          className="!bg-card !border-border"
          nodeColor="hsl(var(--primary))"
        />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="hsl(var(--border))" />
      </ReactFlow>
    </div>
  );
}
