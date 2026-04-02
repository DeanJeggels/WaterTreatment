import { create } from 'zustand';
import type { SimulationResults, DischargeStandards, WaterQuality } from '@repo/sim-engine';
import { simulate, checkCompliance } from '@repo/sim-engine';
import { useFlowsheetStore } from './flowsheet-store';

interface SimulationState {
  results: SimulationResults | null;
  status: 'idle' | 'running' | 'completed' | 'error';
  error: string | null;
  dischargeStandards: DischargeStandards;
  compliance: Record<string, { value: number; limit: number; pass: boolean }> | null;

  runSimulation: () => void;
  setDischargeStandards: (standards: DischargeStandards) => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  results: null,
  status: 'idle',
  error: null,
  dischargeStandards: {
    COD: 75,
    BOD5: 10,
    NH3N: 6,
    TSS: 25,
    TP: 10,
    pH_min: 5.5,
    pH_max: 9.5,
  },
  compliance: null,

  runSimulation: () => {
    set({ status: 'running', error: null });

    try {
      const { nodes, edges } = useFlowsheetStore.getState();

      // Convert React Flow nodes/edges to sim-engine format
      const simNodes = nodes.map((n) => ({
        id: n.id,
        type: n.type ?? 'processUnit',
        data: n.data as Record<string, unknown>,
      }));

      const simEdges = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? 'out',
        targetHandle: e.targetHandle ?? 'in',
      }));

      const results = simulate(simNodes, simEdges);

      // Check compliance at effluent nodes
      let compliance: Record<string, { value: number; limit: number; pass: boolean }> | null = null;
      const effluentNodes = nodes.filter((n) => n.data.unitType === 'effluent');
      for (const eff of effluentNodes) {
        const nodeResult = results.nodeResults[eff.id];
        if (nodeResult) {
          const outputWQ = Object.values(nodeResult.outputs)[0];
          if (outputWQ) {
            const standards = useSimulationStore.getState().dischargeStandards;
            compliance = checkCompliance(outputWQ as WaterQuality, standards);
          }
        }
      }

      set({ results, status: 'completed', compliance });
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'Simulation failed',
      });
    }
  },

  setDischargeStandards: (standards) => set({ dischargeStandards: standards }),
}));
