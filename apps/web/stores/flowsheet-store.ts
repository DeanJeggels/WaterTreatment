import { create } from 'zustand';
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react';
import type { UnitType } from '@repo/sim-engine';
import { unitDefinitions } from '@repo/sim-engine';

export interface FlowsheetNodeData {
  unitType: UnitType;
  label: string;
  parameters: Record<string, number>;
  [key: string]: unknown;
}

export type FlowsheetNode = Node<FlowsheetNodeData>;
export type FlowsheetEdge = Edge;

interface FlowsheetState {
  nodes: FlowsheetNode[];
  edges: FlowsheetEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;

  onNodesChange: OnNodesChange<FlowsheetNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  addNode: (type: UnitType, position: { x: number; y: number }) => void;
  spliceNodeOntoEdge: (type: UnitType, position: { x: number; y: number }, edgeId: string) => void;
  updateNodeData: (id: string, data: Partial<FlowsheetNodeData>) => void;
  updateEdgeData: (id: string, data: Record<string, unknown>) => void;
  deleteNode: (id: string) => void;
  deleteEdge: (id: string) => void;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setNodes: (nodes: FlowsheetNode[]) => void;
  setEdges: (edges: FlowsheetEdge[]) => void;
}

let nodeIdCounter = 0;

// Cache the lazy import to avoid creating a new promise on every callback
let projectStorePromise: Promise<typeof import('./project-store')> | null = null;
function getProjectStore() {
  if (!projectStorePromise) projectStorePromise = import('./project-store');
  return projectStorePromise;
}

export const useFlowsheetStore = create<FlowsheetState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) as FlowsheetNode[] });
    // Mark dirty for auto-save (lazy import to avoid circular deps)
    getProjectStore().then(m => m.useProjectStore.getState().markDirty());
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
    getProjectStore().then(m => m.useProjectStore.getState().markDirty());
  },

  onConnect: (connection) => {
    set({ edges: addEdge(connection, get().edges) });
    getProjectStore().then(m => m.useProjectStore.getState().markDirty());
  },

  addNode: (type, position) => {
    const def = unitDefinitions[type];
    const id = `${type}-${++nodeIdCounter}`;
    const newNode: FlowsheetNode = {
      id,
      type: 'processUnit',
      position,
      data: {
        unitType: type,
        label: def.label,
        parameters: { ...def.defaultParameters },
      },
    };
    set({ nodes: [...get().nodes, newNode] });
    getProjectStore().then(m => m.useProjectStore.getState().markDirty());
  },

  spliceNodeOntoEdge: (type, position, edgeId) => {
    const edge = get().edges.find((e) => e.id === edgeId);
    if (!edge) {
      get().addNode(type, position);
      return;
    }
    const def = unitDefinitions[type];
    const id = `${type}-${++nodeIdCounter}`;
    const newNode: FlowsheetNode = {
      id,
      type: 'processUnit',
      position,
      data: {
        unitType: type,
        label: def.label,
        parameters: { ...def.defaultParameters },
      },
    };
    const e1: FlowsheetEdge = {
      id: `${edge.source}-${id}`,
      source: edge.source,
      target: id,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: 'in',
    };
    const e2: FlowsheetEdge = {
      id: `${id}-${edge.target}`,
      source: id,
      target: edge.target,
      sourceHandle: 'out',
      targetHandle: edge.targetHandle ?? null,
    };
    set({
      nodes: [...get().nodes, newNode],
      edges: [...get().edges.filter((e) => e.id !== edgeId), e1, e2],
    });
    getProjectStore().then(m => m.useProjectStore.getState().markDirty());
  },

  updateNodeData: (id, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node
      ),
    });
    getProjectStore().then(m => m.useProjectStore.getState().markDirty());
  },

  updateEdgeData: (id, data) => {
    set({
      edges: get().edges.map((e) =>
        e.id === id ? { ...e, data: { ...(e.data ?? {}), ...data } } : e
      ),
    });
    getProjectStore().then(m => m.useProjectStore.getState().markDirty());
  },

  deleteNode: (id) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
    });
    getProjectStore().then(m => m.useProjectStore.getState().markDirty());
  },

  deleteEdge: (id) => {
    set({
      edges: get().edges.filter((e) => e.id !== id),
      selectedEdgeId: get().selectedEdgeId === id ? null : get().selectedEdgeId,
    });
    getProjectStore().then(m => m.useProjectStore.getState().markDirty());
  },

  selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
}));
