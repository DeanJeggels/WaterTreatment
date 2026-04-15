'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ReactFlowProvider } from '@xyflow/react';
import Canvas from '@/components/canvas/Canvas';
import UnitPalette from '@/components/canvas/UnitPalette';
import InspectorPanel from '@/components/inspector/InspectorPanel';
import ResultsPanel from '@/components/results/ResultsPanel';
import { useSimulationStore } from '@/stores/simulation-store';
import { useProjectStore } from '@/stores/project-store';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ProjectEditorTabs } from '@/components/layout/project-editor-tabs';
import { Play, Loader2, Save, Check, FileText, Share2, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useSubscription } from '@/lib/hooks/use-subscription';
import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { ErrorBoundary } from '@/components/error-boundary';

export default function FlowsheetEditorPage() {
  const params = useParams<{ id: string; flowsheetId: string }>();
  const { runSimulation, status } = useSimulationStore();
  const {
    projectName,
    flowsheetName,
    isSaving,
    isLoading,
    lastSaved,
    hasUnsavedChanges,
    setProject,
    loadFlowsheet,
    saveFlowsheet,
  } = useProjectStore();
  const { limits } = useSubscription();
  const nodes = useFlowsheetStore((s) => s.nodes);
  const isRunning = status === 'running';
  const canGenerateReport = limits.pdfReports;
  const atUnitLimit = nodes.length >= limits.maxUnitsPerFlowsheet;

  async function handleGenerateReport() {
    if (!canGenerateReport) {
      toast.error('PDF reports require a Pro or Enterprise plan');
      return;
    }
    const { results, compliance, dischargeStandards } = useSimulationStore.getState();
    if (!results) {
      toast.error('Run a simulation first to generate a report');
      return;
    }

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('You must be logged in');
        return;
      }

      toast.info('Generating report...');

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-report`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            flowsheetId: params.flowsheetId,
            simulationResults: results,
            compliance,
            dischargeStandards,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate report');
      }

      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
      toast.success('Report opened — use Print > Save as PDF');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Report generation failed');
    }
  }

  async function handleShare() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('You must be logged in'); return; }

      const { data, error } = await supabase
        .from('share_links')
        .insert({ flowsheet_id: params.flowsheetId, created_by: user.id })
        .select('token')
        .single();

      if (error) throw error;

      const shareUrl = `${window.location.origin}/shared/${data.token}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied to clipboard!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create share link');
    }
  }

  useEffect(() => {
    setProject(params.id, params.flowsheetId);
    loadFlowsheet();
  }, [params.id, params.flowsheetId, setProject, loadFlowsheet]);

  // Auto-save with debounce
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const timer = setTimeout(() => {
      saveFlowsheet();
    }, 3000);
    return () => clearTimeout(timer);
  }, [hasUnsavedChanges, saveFlowsheet]);

  // Keyboard shortcut: Ctrl/Cmd+S to save
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveFlowsheet();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveFlowsheet]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen bg-background">
        {/* Top Bar */}
        <header className="flex items-center justify-between h-12 px-3 sm:px-4 border-b border-border bg-card shrink-0 gap-2 print:hidden">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link href="/dashboard" className="text-sm font-bold hover:opacity-80 shrink-0">
              Aqua<span className="text-primary">Sim</span>
            </Link>
            <span className="text-muted-foreground hidden sm:inline">/</span>
            <span className="text-sm truncate hidden sm:inline">{projectName}</span>
            <span className="text-muted-foreground hidden md:inline">/</span>
            <span className="text-sm text-muted-foreground truncate hidden md:inline">{flowsheetName}</span>
            <ProjectEditorTabs projectId={params.id} flowsheetId={params.flowsheetId} />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {lastSaved && (
              <span className="text-xs text-muted-foreground hidden lg:flex items-center gap-1">
                <Check className="h-3 w-3" />
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={saveFlowsheet} disabled={isSaving} title="Save">
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin md:mr-1" />
              ) : (
                <Save className="h-3.5 w-3.5 md:mr-1" />
              )}
              <span className="hidden md:inline">Save</span>
            </Button>
            <Button
              size="sm"
              onClick={runSimulation}
              disabled={isRunning}
              title="Run Simulation"
            >
              {isRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin md:mr-1" />
              ) : (
                <Play className="h-3.5 w-3.5 md:mr-1" />
              )}
              <span className="hidden md:inline">Run Simulation</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateReport}
              disabled={status !== 'completed' && canGenerateReport}
              title={canGenerateReport ? 'Generate PDF report' : 'Upgrade to Pro for PDF reports'}
            >
              <FileText className="h-3.5 w-3.5 md:mr-1" />
              <span className="hidden md:inline">Report{!canGenerateReport && ' (Pro)'}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare} title="Share">
              <Share2 className="h-3.5 w-3.5 md:mr-1" />
              <span className="hidden md:inline">Share</span>
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <div className="relative flex flex-1 overflow-hidden">
          <UnitPalette disabled={atUnitLimit} unitCount={nodes.length} unitLimit={limits.maxUnitsPerFlowsheet} />
          <ErrorBoundary fallbackLabel="Canvas">
            <Canvas />
          </ErrorBoundary>

          {/* Inspector — permanent rail on lg+, Sheet trigger below lg */}
          <div className="hidden lg:block">
            <InspectorPanel />
          </div>
          <Sheet>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="lg:hidden fixed bottom-4 right-4 z-40 shadow-lg"
                  aria-label="Open inspector"
                  title="Inspector"
                />
              }
            >
              <SlidersHorizontal className="h-4 w-4" />
            </SheetTrigger>
            <SheetContent side="right" className="w-[90vw] sm:max-w-sm p-0 overflow-y-auto">
              <InspectorPanel />
            </SheetContent>
          </Sheet>
        </div>

        {/* Bottom: Results */}
        <ErrorBoundary fallbackLabel="Results panel">
          <ResultsPanel />
        </ErrorBoundary>
      </div>
    </ReactFlowProvider>
  );
}
