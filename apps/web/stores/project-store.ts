import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import { useFlowsheetStore } from './flowsheet-store';
import type { FlowsheetNode, FlowsheetEdge } from './flowsheet-store';

interface ProjectState {
  projectId: string | null;
  projectName: string;
  flowsheetId: string | null;
  flowsheetName: string;
  isSaving: boolean;
  isLoading: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;

  setProject: (projectId: string, flowsheetId: string) => void;
  loadFlowsheet: () => Promise<void>;
  saveFlowsheet: () => Promise<void>;
  markDirty: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectId: null,
  projectName: 'Untitled Project',
  flowsheetId: null,
  flowsheetName: 'Scenario 1',
  isSaving: false,
  isLoading: false,
  lastSaved: null,
  hasUnsavedChanges: false,

  setProject: (projectId, flowsheetId) => {
    set({ projectId, flowsheetId });
  },

  loadFlowsheet: async () => {
    const { projectId, flowsheetId } = get();
    if (!projectId || !flowsheetId) return;

    set({ isLoading: true });
    const supabase = createClient();

    // Load project name
    const { data: project } = await supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single();

    // Load flowsheet
    const { data: flowsheet } = await supabase
      .from('flowsheets')
      .select('name, graph_data, discharge_standards')
      .eq('id', flowsheetId)
      .single();

    if (flowsheet?.graph_data && typeof flowsheet.graph_data === 'object') {
      const raw = flowsheet.graph_data as Record<string, unknown>;
      const graphData = {
        nodes: Array.isArray(raw.nodes) ? raw.nodes as FlowsheetNode[] : [],
        edges: Array.isArray(raw.edges) ? raw.edges as FlowsheetEdge[] : [],
      };
      const { setNodes, setEdges } = useFlowsheetStore.getState();
      setNodes(graphData.nodes);
      setEdges(graphData.edges);
    }

    set({
      projectName: project?.name ?? 'Untitled Project',
      flowsheetName: flowsheet?.name ?? 'Scenario 1',
      isLoading: false,
      hasUnsavedChanges: false,
    });
  },

  saveFlowsheet: async () => {
    const { flowsheetId } = get();
    if (!flowsheetId) return;

    set({ isSaving: true });
    const supabase = createClient();
    const { nodes, edges } = useFlowsheetStore.getState();

    const { error } = await supabase
      .from('flowsheets')
      .update({
        graph_data: { nodes, edges },
        updated_at: new Date().toISOString(),
      })
      .eq('id', flowsheetId);

    // Also update project updated_at
    const { projectId } = get();
    if (projectId) {
      await supabase
        .from('projects')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', projectId);
    }

    set({
      isSaving: false,
      lastSaved: error ? get().lastSaved : new Date(),
      hasUnsavedChanges: error ? true : false,
    });
  },

  markDirty: () => set({ hasUnsavedChanges: true }),
}));
