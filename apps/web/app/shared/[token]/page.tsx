'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ReactFlowProvider, ReactFlow, Background, Controls } from '@xyflow/react';
import ProcessUnitNode from '@/components/canvas/custom-nodes/ProcessUnitNode';
import ResultsPanel from '@/components/results/ResultsPanel';
import { useFlowsheetStore } from '@/stores/flowsheet-store';
import { useSimulationStore } from '@/stores/simulation-store';
import { Loader2 } from 'lucide-react';
import '@xyflow/react/dist/style.css';

const nodeTypes = { processUnit: ProcessUnitNode } as any;

export default function SharedFlowsheetPage() {
  const params = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [flowsheetName, setFlowsheetName] = useState('');
  const { nodes, edges, setNodes, setEdges } = useFlowsheetStore();

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Look up share link (anon access via RLS policy)
      const { data: link, error: linkErr } = await supabase
        .from('share_links')
        .select('flowsheet_id')
        .eq('token', params.token)
        .eq('is_active', true)
        .single();

      if (linkErr || !link) {
        setError('This share link is invalid or has expired.');
        setLoading(false);
        return;
      }

      // Fetch flowsheet data (anon access via flowsheets_shared_read policy)
      const { data: flowsheet, error: fsErr } = await supabase
        .from('flowsheets')
        .select('name, graph_data, project_id')
        .eq('id', link.flowsheet_id)
        .single();

      if (fsErr || !flowsheet) {
        setError('Flowsheet not found.');
        setLoading(false);
        return;
      }

      const graphData = flowsheet.graph_data as { nodes?: any[]; edges?: any[] };
      if (graphData.nodes) setNodes(graphData.nodes);
      if (graphData.edges) setEdges(graphData.edges);
      setFlowsheetName(flowsheet.name ?? 'Shared Flowsheet');
      setProjectName('Shared View');
      setLoading(false);
    }

    load();
  }, [params.token, setNodes, setEdges]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Link Unavailable</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen bg-background">
        <header className="flex items-center justify-between h-12 px-4 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold">
              BioWin <span className="text-primary">Clone</span>
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm">{flowsheetName}</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">View Only</span>
          </div>
        </header>

        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag
            zoomOnScroll
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </div>
    </ReactFlowProvider>
  );
}
