'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ReactFlowProvider, ReactFlow, Background, Controls } from '@xyflow/react';
import ProcessUnitNode from '@/components/canvas/custom-nodes/ProcessUnitNode';
import { useFlowsheetStore } from '@/stores/flowsheet-store';
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

      // Single RPC call replaces the broken two-query pattern.
      // get_shared_flowsheet is a SECURITY DEFINER function that validates
      // the token, checks is_active + expiry, and returns only the columns
      // the shared page needs (no proposal_data, no PII).
      const { data, error: rpcErr } = await supabase
        .rpc('get_shared_flowsheet', { p_token: params.token })
        .single();

      if (rpcErr || !data) {
        setError('This share link is invalid or has expired.');
        setLoading(false);
        return;
      }

      const graphData = (data as { graph_data?: { nodes?: any[]; edges?: any[] } }).graph_data;
      if (graphData?.nodes) setNodes(graphData.nodes);
      if (graphData?.edges) setEdges(graphData.edges);
      setFlowsheetName((data as { name?: string }).name ?? 'Shared Flowsheet');
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
              Aqua<span className="text-primary">Sim</span>
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
