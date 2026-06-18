'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import type { DesignInputs } from '@repo/auto-design';
import { ProjectEditorTabs } from '@/components/layout/project-editor-tabs';
import { PageShell } from '@/components/layout/page-shell';
import { useProjectStore } from '@/stores/project-store';
import { persistDesignInputs } from '@/lib/design/persist-inputs';
import { DesignWizard } from './_components/design-wizard';

/**
 * AquaSim v3 — Design tab (Phase 0 stub).
 *
 * Coexists with the Flowsheet | Proposal tabs and shares the same project /
 * flowsheet model. The guided wizard + auto-design package viewer land here in
 * later phases (T1.3 onward); this stub just locks the route + tab boundary.
 */
export default function DesignPage() {
  const params = useParams<{ id: string; flowsheetId: string }>();
  const { projectName, flowsheetName, setProject, loadFlowsheet } = useProjectStore();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setProject(params.id, params.flowsheetId);
    loadFlowsheet();
  }, [params.id, params.flowsheetId, setProject, loadFlowsheet]);

  async function handleSubmit(inputs: DesignInputs) {
    // T1.4: persist the inputs draft (package stays NULL until the design runs in T5.3).
    setSubmitting(true);
    try {
      await persistDesignInputs(params.id, params.flowsheetId, inputs);
      toast.success('Design inputs saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save design inputs');
    } finally {
      setSubmitting(false);
    }
  }

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
      </header>

      <main className="container mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Guided design</h1>
          <p className="text-sm text-muted-foreground">
            Enter your inputs once. AquaSim sizes the plant, places a 2D layout, and produces a
            compliance verdict and downloadable package — every number traceable to a calculation.
          </p>
        </div>
        <DesignWizard initialName={projectName} onSubmit={handleSubmit} submitting={submitting} />
      </main>
    </PageShell>
  );
}
