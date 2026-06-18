'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Wand2 } from 'lucide-react';
import { ProjectEditorTabs } from '@/components/layout/project-editor-tabs';
import { PageShell } from '@/components/layout/page-shell';
import { useProjectStore } from '@/stores/project-store';

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

  useEffect(() => {
    setProject(params.id, params.flowsheetId);
    loadFlowsheet();
  }, [params.id, params.flowsheetId, setProject, loadFlowsheet]);

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

      <main className="container mx-auto max-w-2xl px-6 py-16">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
            <Wand2 className="h-6 w-6 text-accent-foreground" />
          </div>
          <h1 className="text-lg font-semibold">Design — coming soon</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Enter your project inputs once and AquaSim will generate a preliminary engineering design
            package: sized units, a placed 2D plant layout, a compliance verdict, and downloadable
            JSON / PDF / Excel where every number traces back to a cited calculation.
          </p>
        </div>
      </main>
    </PageShell>
  );
}
