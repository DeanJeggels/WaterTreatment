'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Save, FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ProjectEditorTabs } from '@/components/layout/project-editor-tabs';
import { PageShell } from '@/components/layout/page-shell';
import { ErrorBoundary } from '@/components/error-boundary';
import { useProjectStore } from '@/stores/project-store';
import { useSimulationStore } from '@/stores/simulation-store';
import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { useSubscription } from '@/lib/hooks/use-subscription';
import { ProposalDocument } from '@/lib/proposal/ProposalDocument';
import { useProposalData } from '@/lib/proposal/use-proposal-data';
import { saveBoqLineItems, createProposalSnapshot } from '@/lib/proposal/generate-proposal';

export default function ProposalPage() {
  const params = useParams<{ id: string; flowsheetId: string }>();
  const { projectName, flowsheetName, setProject, loadFlowsheet } = useProjectStore();
  const results = useSimulationStore((s) => s.results);
  const nodes = useFlowsheetStore((s) => s.nodes);
  const { limits } = useSubscription();
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setProject(params.id, params.flowsheetId);
    loadFlowsheet();
  }, [params.id, params.flowsheetId, setProject, loadFlowsheet]);

  const { proposalData, setProposalData, profile, boq, effluentStream, dischargeStandard, loading, error } =
    useProposalData(params.flowsheetId);

  const handleSaveBoq = useCallback(async () => {
    if (!boq) {
      toast.error('No BoQ to save — run the simulation first');
      return;
    }
    setIsSaving(true);
    try {
      const { count } = await saveBoqLineItems({ flowsheetId: params.flowsheetId, boq });
      toast.success(`Saved ${count} BoQ line items`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save BoQ');
    } finally {
      setIsSaving(false);
    }
  }, [boq, params.flowsheetId]);

  const handleGeneratePdf = useCallback(async () => {
    if (!limits.pdfReports) {
      toast.error('PDF generation requires a Pro or Enterprise plan');
      return;
    }
    if (!results) {
      toast.error('Run the simulation first');
      return;
    }
    if (!boq) {
      toast.error('No BoQ available — run the simulation first');
      return;
    }

    setIsGenerating(true);
    try {
      await saveBoqLineItems({ flowsheetId: params.flowsheetId, boq });
      const nodeList = nodes.map((n) => ({
        id: n.id,
        type: n.data.unitType,
        parameters: n.data.parameters ?? {},
      }));
      const { version } = await createProposalSnapshot({
        flowsheetId: params.flowsheetId,
        proposalData,
        results,
        boq,
        nodes: nodeList,
      });
      toast.success(`Proposal v${version} saved — opening print dialog`);
      // Small delay so the toast renders before print
      setTimeout(() => window.print(), 250);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate proposal');
    } finally {
      setIsGenerating(false);
    }
  }, [limits.pdfReports, results, boq, proposalData, nodes, params.flowsheetId]);

  return (
    <PageShell>
      <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-2 print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard" className="text-sm font-bold hover:opacity-80 shrink-0">
            Aqua<span className="text-primary">Sim</span>
          </Link>
          <span className="text-muted-foreground hidden sm:inline">/</span>
          <span className="text-sm truncate hidden sm:inline">{projectName}</span>
          <span className="text-muted-foreground hidden md:inline">/</span>
          <span className="text-sm text-muted-foreground truncate hidden md:inline">{flowsheetName}</span>
          <ProjectEditorTabs projectId={params.id} flowsheetId={params.flowsheetId} />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveBoq}
            disabled={isSaving || !boq}
            title="Save BoQ"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin md:mr-1" /> : <Save className="h-4 w-4 md:mr-1" />}
            <span className="hidden md:inline">Save BoQ</span>
          </Button>
          <Button
            size="sm"
            onClick={handleGeneratePdf}
            disabled={isGenerating || !results || !boq}
            title={limits.pdfReports ? 'Generate proposal PDF' : 'Upgrade to Pro for PDF generation'}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin md:mr-1" />
            ) : (
              <FileDown className="h-4 w-4 md:mr-1" />
            )}
            <span className="hidden md:inline">Generate PDF{!limits.pdfReports && ' (Pro)'}</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-6 py-8 print:px-0 print:py-0 print:max-w-none">
        <ErrorBoundary fallbackLabel="Proposal">
          {error && (
            <div className="mb-6 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive print:hidden">
              {error}
            </div>
          )}
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading proposal…</div>
          ) : (
            <ProposalDocument
              proposalData={proposalData}
              onChange={setProposalData}
              profile={profile}
              results={results}
              boq={boq}
              effluentStream={effluentStream}
              dischargeStandard={dischargeStandard}
              flowsheetName={flowsheetName ?? 'Untitled flowsheet'}
              projectName={projectName ?? 'Untitled project'}
            />
          )}
        </ErrorBoundary>
      </main>
    </PageShell>
  );
}
