'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { aggregateBoQ, type AggregatedBoQ, type FlowsheetNodeLite, type WaterQuality } from '@repo/sim-engine';
import { getDwaLimits, type DwaDischargeStandard } from '@repo/design-library';
import { createClient } from '@/lib/supabase/client';
import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { useSimulationStore } from '@/stores/simulation-store';
import type { ProposalData, ProposalProfile } from './ProposalDocument';

interface UseProposalDataResult {
  proposalData: ProposalData;
  setProposalData: (data: ProposalData) => void;
  profile: ProposalProfile;
  boq: AggregatedBoQ | null;
  effluentStream: WaterQuality | null;
  dischargeStandard: DwaDischargeStandard;
  loading: boolean;
  error: string | null;
}

const DEBOUNCE_MS = 1000;

export function useProposalData(flowsheetId: string): UseProposalDataResult {
  const supabase = useMemo(() => createClient(), []);
  const nodes = useFlowsheetStore((s) => s.nodes);
  const results = useSimulationStore((s) => s.results);

  const [proposalData, setProposalDataLocal] = useState<ProposalData>({});
  const [profile, setProfile] = useState<ProposalProfile>({
    full_name: null,
    company: null,
    company_logo_url: null,
    designer_title: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load proposal_data + profile once on flowsheetId change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [{ data: fs, error: fsErr }, { data: { user } }] = await Promise.all([
          supabase.from('flowsheets').select('proposal_data').eq('id', flowsheetId).single(),
          supabase.auth.getUser(),
        ]);
        if (fsErr) throw fsErr;
        if (cancelled) return;
        if (fs?.proposal_data) {
          setProposalDataLocal(fs.proposal_data as ProposalData);
        }

        if (user) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name, company, company_logo_url, designer_title')
            .eq('id', user.id)
            .single();
          if (!cancelled && prof) {
            setProfile({
              full_name: prof.full_name ?? null,
              company: prof.company ?? null,
              company_logo_url: prof.company_logo_url ?? null,
              designer_title: prof.designer_title ?? null,
            });
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load proposal data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [flowsheetId, supabase]);

  // Debounced save back to flowsheets.proposal_data
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setProposalData = useCallback(
    (next: ProposalData) => {
      setProposalDataLocal(next);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        const { error: updErr } = await supabase
          .from('flowsheets')
          .update({ proposal_data: next })
          .eq('id', flowsheetId);
        if (updErr) setError(updErr.message);
      }, DEBOUNCE_MS);
    },
    [flowsheetId, supabase],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Aggregate BoQ from live nodes + results
  const boq = useMemo<AggregatedBoQ | null>(() => {
    if (!results) return null;
    const nodeList: FlowsheetNodeLite[] = nodes.map((n) => ({
      id: n.id,
      type: n.data.unitType,
      parameters: n.data.parameters ?? {},
    }));
    return aggregateBoQ(nodeList, results.nodeResults);
  }, [nodes, results]);

  // Final effluent stream — first 'effluent' node's first output
  const effluentStream = useMemo<WaterQuality | null>(() => {
    if (!results) return null;
    const effNode = nodes.find((n) => n.data.unitType === 'effluent');
    if (!effNode) return null;
    const nr = results.nodeResults[effNode.id];
    if (!nr) return null;
    const first = Object.values(nr.outputs)[0];
    return (first as WaterQuality) ?? null;
  }, [nodes, results]);

  // Default to General DWA limits — tier selector is a later phase
  const dischargeStandard = useMemo(() => getDwaLimits('General'), []);

  return {
    proposalData,
    setProposalData,
    profile,
    boq,
    effluentStream,
    dischargeStandard,
    loading,
    error,
  };
}
