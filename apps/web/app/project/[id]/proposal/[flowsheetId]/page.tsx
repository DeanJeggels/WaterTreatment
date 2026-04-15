'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ProjectEditorTabs } from '@/components/layout/project-editor-tabs';
import { PageShell } from '@/components/layout/page-shell';
import { useProjectStore } from '@/stores/project-store';
import { useSimulationStore } from '@/stores/simulation-store';
import { ErrorBoundary } from '@/components/error-boundary';
import { ProposalDocument } from '@/lib/proposal/ProposalDocument';
import { useProposalData } from '@/lib/proposal/use-proposal-data';

export default function ProposalPage() {
  const params = useParams<{ id: string; flowsheetId: string }>();
  const { projectName, flowsheetName, setProject, loadFlowsheet } = useProjectStore();
  const results = useSimulationStore((s) => s.results);

  useEffect(() => {
    setProject(params.id, params.flowsheetId);
    loadFlowsheet();
  }, [params.id, params.flowsheetId, setProject, loadFlowsheet]);

  const { proposalData, setProposalData, profile, boq, effluentStream, dischargeStandard, loading, error } =
    useProposalData(params.flowsheetId);

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
          {/* Save BoQ + Generate PDF buttons — Task 11 */}
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
