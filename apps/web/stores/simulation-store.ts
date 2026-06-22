import { create } from 'zustand';
import type {
  SimulationResults, DischargeStandards, WaterQuality, PlantEvaluation, MleMbrDesign, Objectives,
} from '@repo/sim-engine';
import { simulate, checkCompliance, evaluatePlant } from '@repo/sim-engine';
import { useFlowsheetStore } from './flowsheet-store';
import type { FlowsheetNode, FlowsheetEdge } from './flowsheet-store';

/**
 * A design chosen in the optimiser and explicitly applied to the flowsheet.
 * This is the AUTHORITATIVE record of what the engineer picked: the exact
 * validated design (the same numbers shown in the optimiser detail panel) plus
 * its objectives. The Design Summary and the reactor-block sizing are driven
 * from this so what you see after "Apply to flowsheet" always equals what you
 * clicked — instead of trusting the re-run to re-recognise the canvas and
 * re-derive an identical design (which silently fails when the drawn topology
 * doesn't perfectly match the chosen point).
 *
 * `signature` is a fingerprint of the canvas (influent load + topology + the
 * drivers we applied). When the canvas changes in a way that would change the
 * design, the signature no longer matches and the applied design is dropped so
 * it can never go stale and lie.
 */
export interface AppliedDesign {
  design: MleMbrDesign;
  objectives: Pick<Objectives, 'capexZar' | 'opexZarPerYear' | 'footprintM2' | 'effluentQualityIndex'>;
  trainLabel: string;
  signature: string;
}

/** Fingerprint the canvas: influent load + topology + the sizing drivers. */
function canvasSignature(nodes: FlowsheetNode[], edges: FlowsheetEdge[]): string {
  const influent = nodes.find((n) => n.data.unitType === 'influent');
  const ip = (influent?.data.parameters ?? {}) as Record<string, number>;
  const blocks = nodes
    .filter((n) => n.data.unitType !== 'influent' && n.data.unitType !== 'effluent')
    .map((n) => {
      const p = n.data.parameters as Record<string, number>;
      return `${n.id}:${n.data.unitType}:${p.srt ?? ''}:${p.mlss ?? ''}:${p.anoxic_fraction ?? ''}`;
    })
    .sort();
  const recycles = edges
    .map((e) => (e.data as { recycleRatio?: number } | undefined)?.recycleRatio)
    .filter((r): r is number => r !== undefined)
    .sort((a, b) => a - b);
  return [
    `Q=${ip.flow ?? ''}`, `COD=${ip.COD ?? ''}`, `T=${ip.temperature ?? ''}`,
    `n=${nodes.length}`, `e=${edges.length}`,
    blocks.join('|'), `r=${recycles.join(',')}`,
  ].join(';');
}

interface SimulationState {
  results: SimulationResults | null;
  /** Consolidated headless-engine result: ledger, CAPEX/OPEX/footprint, recognised train + delegated design. */
  evaluation: PlantEvaluation | null;
  /** The optimiser design explicitly applied to the flowsheet (authoritative), or null. */
  appliedDesign: AppliedDesign | null;
  status: 'idle' | 'running' | 'completed' | 'error';
  error: string | null;
  dischargeStandards: DischargeStandards;
  compliance: Record<string, { value: number; limit: number; pass: boolean }> | null;

  runSimulation: () => void;
  /** Record an optimiser-chosen design as the authoritative applied design, then re-run. */
  applyOptimizedDesign: (payload: { design: MleMbrDesign; objectives: AppliedDesign['objectives']; trainLabel: string }) => void;
  clearAppliedDesign: () => void;
  setDischargeStandards: (standards: DischargeStandards) => void;
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  results: null,
  evaluation: null,
  appliedDesign: null,
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
        recycleRatio: (e.data as { recycleRatio?: number } | undefined)?.recycleRatio,
      }));

      const results = simulate(simNodes, simEdges);
      const standards = useSimulationStore.getState().dischargeStandards;

      // Consolidated headless-engine pass: mass-balance ledger, CAPEX/OPEX/footprint,
      // MLE/MBR recognition + delegated (exact spreadsheet) design, combined-effluent compliance.
      const evaluation = evaluatePlant({ nodes: simNodes, edges: simEdges, standards });

      // Drop a previously applied optimiser design if the canvas has since changed
      // in a way that would change the design (topology or any sizing driver). This
      // keeps the applied design honest — it only survives a re-run on the same plant.
      const signature = canvasSignature(nodes, edges);
      const prevApplied = get().appliedDesign;
      const appliedDesign = prevApplied && prevApplied.signature === signature ? prevApplied : null;

      // Size the reactor blocks. Priority:
      //   1. the explicitly applied optimiser design (authoritative — what the user picked), else
      //   2. the live delegated design when the drawn graph is a recognised MLE/MBR train.
      // Both override the per-block estimate (which over-sizes under recycle) so the
      // blocks match the validated whole-reactor design and the Design Summary reflects
      // exactly the chosen/recognised design.
      const train = evaluation.recognisedTrain;
      const design: MleMbrDesign | null = appliedDesign?.design ?? (train.matched ? evaluation.delegatedDesign : null);
      if (design) {
        // Prefer the recognised-train node ids; fall back to finding the reactor blocks by
        // type so an applied design still lands even if recognition trips on the canvas.
        const findId = (unitType: string) => nodes.find((n) => n.data.unitType === unitType)?.id;
        const aerobicId = train.aerobicNodeId ?? findId('bioreactor_aerobic');
        const anoxicId = train.anoxicNodeId ?? findId('bioreactor_anoxic');
        const anaerobicId = train.anaerobicNodeId ?? findId('bioreactor_anaerobic');
        const separatorId = train.separatorNodeId ?? findId('mbr');
        const note = appliedDesign
          ? `Sized by the applied optimiser design (${appliedDesign.trainLabel}).`
          : 'Sized by the recognised MLE/MBR whole-reactor design (matches the guided design).';

        const patch = (nodeId: string | undefined, sizing: Record<string, { value: number; unit: string }>) => {
          if (!nodeId) return;
          const nr = results.nodeResults[nodeId];
          if (!nr) return;
          nr.sizing = { ...(nr.sizing ?? {}), ...sizing };
          nr.warnings = [...(nr.warnings ?? []), note];
        };
        patch(aerobicId, {
          volume: { value: design.reactor.aerobicVolumeM3, unit: 'm3' },
          requiredVolume: { value: design.reactor.aerobicVolumeM3, unit: 'm3' },
          HRT: { value: design.reactor.aerobicHrtH, unit: 'h' },
        });
        if (design.reactor.anoxicVolumeM3 > 0) {
          patch(anoxicId, {
            volume: { value: design.reactor.anoxicVolumeM3, unit: 'm3' },
            requiredVolume: { value: design.reactor.anoxicVolumeM3, unit: 'm3' },
            HRT: { value: design.reactor.anoxicHrtH, unit: 'h' },
          });
        }
        if (design.reactor.anaerobicVolumeM3 > 0) {
          patch(anaerobicId, {
            volume: { value: design.reactor.anaerobicVolumeM3, unit: 'm3' },
            HRT: { value: design.reactor.anaerobicHrtH, unit: 'h' },
          });
        }
        if (design.mbr.included) {
          patch(separatorId, {
            membraneArea: { value: design.mbr.membraneAreaM2, unit: 'm2' },
            modules: { value: design.mbr.moduleCount, unit: 'ea' },
          });
        }
      }

      // Compliance: prefer the combined-effluent check from the engine; fall back to
      // the first effluent node so older single-outlet flowsheets still report.
      let compliance = evaluation.compliance;
      if (!compliance) {
        const effluentNodes = nodes.filter((n) => n.data.unitType === 'effluent');
        for (const eff of effluentNodes) {
          const outputWQ = results.nodeResults[eff.id] && Object.values(results.nodeResults[eff.id]!.outputs)[0];
          if (outputWQ) compliance = checkCompliance(outputWQ as WaterQuality, standards);
        }
      }

      set({ results, evaluation, appliedDesign, status: 'completed', compliance });
    } catch (err) {
      set({
        status: 'error',
        evaluation: null,
        error: err instanceof Error ? err.message : 'Simulation failed',
      });
    }
  },

  applyOptimizedDesign: ({ design, objectives, trainLabel }) => {
    const { nodes, edges } = useFlowsheetStore.getState();
    set({
      appliedDesign: { design, objectives, trainLabel, signature: canvasSignature(nodes, edges) },
    });
    get().runSimulation();
  },

  clearAppliedDesign: () => set({ appliedDesign: null }),

  setDischargeStandards: (standards) => set({ dischargeStandards: standards }),
}));
