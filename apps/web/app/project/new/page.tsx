'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, FileText, LayoutTemplate } from 'lucide-react';
import Link from 'next/link';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  graph_data: Record<string, unknown>;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  useEffect(() => {
    async function loadTemplates() {
      const supabase = createClient();
      const { data } = await supabase
        .from('templates')
        .select('id, name, description, category, graph_data')
        .eq('is_public', true);
      if (data) setTemplates(data);
    }
    loadTemplates();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    // Create project
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .insert({ name: name.trim(), description: description.trim() || null, owner_id: user.id })
      .select('id')
      .single();

    if (projErr || !project) {
      setError(projErr?.message ?? 'Failed to create project');
      setLoading(false);
      return;
    }

    // Create flowsheet (with template data if selected)
    const template = templates.find(t => t.id === selectedTemplate);
    const flowsheetData: Record<string, unknown> = {
      project_id: project.id,
      name: 'Scenario 1',
    };
    if (template) {
      flowsheetData.graph_data = template.graph_data;
    }

    const { data: flowsheet, error: fsErr } = await supabase
      .from('flowsheets')
      .insert(flowsheetData)
      .select('id')
      .single();

    if (fsErr || !flowsheet) {
      setError(fsErr?.message ?? 'Failed to create flowsheet');
      setLoading(false);
      return;
    }

    router.push(`/project/${project.id}/flowsheet/${flowsheet.id}`);
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-bold">New Project</h1>
        </div>

        <form onSubmit={handleCreate} className="space-y-6">
          {/* Project details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. WWTW Upgrade Phase 1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  placeholder="Brief description of the project"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Template selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Start From</CardTitle>
              <CardDescription>Choose a template or start with a blank canvas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Blank option */}
                <button
                  type="button"
                  onClick={() => setSelectedTemplate(null)}
                  className={`text-left p-4 rounded-lg border-2 transition-colors ${
                    selectedTemplate === null
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <FileText className="h-5 w-5 text-muted-foreground mb-2" />
                  <p className="font-medium text-sm">Blank Canvas</p>
                  <p className="text-xs text-muted-foreground mt-1">Start from scratch</p>
                </button>

                {/* Templates */}
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTemplate(t.id)}
                    className={`text-left p-4 rounded-lg border-2 transition-colors ${
                      selectedTemplate === t.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <LayoutTemplate className="h-5 w-5 text-primary mb-2" />
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading || !name.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Project
          </Button>
        </form>
      </div>
    </div>
  );
}
