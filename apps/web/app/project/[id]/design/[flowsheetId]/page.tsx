'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import type { MleMbrInputs } from '@repo/auto-design';
import type { DesignPackage } from '@repo/object-model';
import { ProjectEditorTabs } from '@/components/layout/project-editor-tabs';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/stores/project-store';
import { runAndPersistMleMbr, loadDesignPackage, loadProjectMeta } from '@/lib/design/run-auto-design';
import { MleMbrWizard } from './_components/mle-mbr-wizard';
import { LayoutSvg } from './_components/layout-svg';
import { DesignSummary } from './_components/design-summary';
import { MleMbrReport } from './_components/mle-mbr-report';

// Three.js touches window — load only on the client.
const PlantViewer3D = dynamic(
  () => import('./_components/plant-viewer-3d').then((m) => m.PlantViewer3D),
  { ssr: false, loading: () => <div className="h-[520px] rounded-md border border-border bg-[#0a0d12]" /> },
);

export default function DesignPage() {
  const params = useParams<{ id: string; flowsheetId: string }>();
  const { projectName, flowsheetName, setProject, loadFlowsheet } = useProjectStore();
  const [submitting, setSubmitting] = useState(false);
  const [pkg, setPkg] = useState<DesignPackage | null>(null);
  const [meta, setMeta] = useState<{ client?: string; siteLocation?: string }>({});
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<'2d' | '3d'>('2d');

  useEffect(() => {
    setProject(params.id, params.flowsheetId);
    loadFlowsheet();
    // Resolve a saved package and the shared project meta before deciding what to
    // render, so the wizard pre-fills (client/location carried from the Proposal).
    Promise.all([loadDesignPackage(params.flowsheetId), loadProjectMeta(params.flowsheetId)])
      .then(([p, m]) => {
        if (p) setPkg(p);
        setMeta(m);
      })
      .finally(() => setReady(true));
  }, [params.id, params.flowsheetId, setProject, loadFlowsheet]);

  async function handleSubmit(inputs: MleMbrInputs) {
    setSubmitting(true);
    try {
      const result = await runAndPersistMleMbr(params.id, params.flowsheetId, inputs);
      setPkg(result);
      toast.success(result.compliance.pass ? 'MLE-MBR design generated — compliant' : 'Design generated — review compliance');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate design');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell>
      <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-2 print:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard" className="shrink-0 text-sm font-bold hover:opacity-80">
            Aqua<span className="text-primary">Sim</span>
          </Link>
          <span className="hidden text-muted-foreground sm:inline">/</span>
          <span className="hidden truncate text-sm sm:inline">{projectName}</span>
          <span className="hidden text-muted-foreground md:inline">/</span>
          <span className="hidden truncate text-sm text-muted-foreground md:inline">{flowsheetName}</span>
          <ProjectEditorTabs projectId={params.id} flowsheetId={params.flowsheetId} />
        </div>
        {pkg && (
          <Button variant="outline" size="sm" onClick={() => setPkg(null)}>
            New design
          </Button>
        )}
      </header>

      <main className="container mx-auto max-w-4xl px-6 py-8">
        {!ready ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : pkg ? (
          <>
            {/* On-screen interactive viewer (hidden when printing). */}
            <div className="space-y-6 print:hidden">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h1 className="text-xl font-semibold">Plant layout</h1>
                  <p className="text-sm text-muted-foreground">
                    {pkg.meta.plantType} train · {pkg.objects.length} units · every number traces to a calculation.
                  </p>
                </div>
                <div className="flex rounded-md border border-border p-0.5 text-sm">
                  <button
                    onClick={() => setView('2d')}
                    className={`rounded px-3 py-1 ${view === '2d' ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground'}`}
                  >
                    2D plan
                  </button>
                  <button
                    onClick={() => setView('3d')}
                    className={`rounded px-3 py-1 ${view === '3d' ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground'}`}
                  >
                    3D
                  </button>
                </div>
              </div>
              {view === '2d' ? (
                <LayoutSvg objects={pkg.objects} layout={pkg.layout} />
              ) : (
                <PlantViewer3D objects={pkg.objects} layout={pkg.layout} />
              )}
              <DesignSummary pkg={pkg} />
            </div>
            {/* Print-only 10-section MLE-MBR report — the PDF target. */}
            <MleMbrReport pkg={pkg} />
          </>
        ) : (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-semibold">MLE-MBR preliminary design</h1>
              <p className="text-sm text-muted-foreground">
                Enter the design basis once. AquaSim derives the influent, sizes the bioreactor, MBR, blowers and
                disinfection, places the plant, and produces a full preliminary design report.
              </p>
            </div>
            <MleMbrWizard
              initialName={projectName}
              initialClient={meta.client}
              initialLocation={meta.siteLocation}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          </div>
        )}
      </main>
    </PageShell>
  );
}
