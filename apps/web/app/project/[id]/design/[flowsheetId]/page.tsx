'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import type { DesignInputs } from '@repo/auto-design';
import type { DesignPackage } from '@repo/object-model';
import { ProjectEditorTabs } from '@/components/layout/project-editor-tabs';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/stores/project-store';
import { runAndPersistDesign, loadDesignPackage } from '@/lib/design/run-auto-design';
import { DesignWizard } from './_components/design-wizard';
import { LayoutSvg } from './_components/layout-svg';
import { DesignSummary } from './_components/design-summary';

export default function DesignPage() {
  const params = useParams<{ id: string; flowsheetId: string }>();
  const { projectName, flowsheetName, setProject, loadFlowsheet } = useProjectStore();
  const [submitting, setSubmitting] = useState(false);
  const [pkg, setPkg] = useState<DesignPackage | null>(null);

  useEffect(() => {
    setProject(params.id, params.flowsheetId);
    loadFlowsheet();
    loadDesignPackage(params.flowsheetId).then((p) => p && setPkg(p));
  }, [params.id, params.flowsheetId, setProject, loadFlowsheet]);

  async function handleSubmit(inputs: DesignInputs) {
    setSubmitting(true);
    try {
      const result = await runAndPersistDesign(params.id, params.flowsheetId, inputs);
      setPkg(result);
      toast.success(result.compliance.pass ? 'Design generated — compliant' : 'Design generated — review compliance');
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
        {pkg ? (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-semibold">Plant layout</h1>
              <p className="text-sm text-muted-foreground">
                {pkg.meta.plantType} train · {pkg.objects.length} units · every number traces to a calculation.
              </p>
            </div>
            <LayoutSvg objects={pkg.objects} layout={pkg.layout} />
            <DesignSummary pkg={pkg} />
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-semibold">Guided design</h1>
              <p className="text-sm text-muted-foreground">
                Enter your inputs once. AquaSim sizes the plant, places a 2D layout, and produces a compliance
                verdict and downloadable package.
              </p>
            </div>
            <DesignWizard initialName={projectName} onSubmit={handleSubmit} submitting={submitting} />
          </div>
        )}
      </main>
    </PageShell>
  );
}
