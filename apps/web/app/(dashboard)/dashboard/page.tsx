import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, FolderOpen, Crown, Zap } from 'lucide-react';
import Link from 'next/link';
import DeleteProjectButton from './delete-project-button';
import SubscriptionManager from './subscription-manager';
import { ThemeToggle } from '@/components/theme-toggle';
import { getPlanLimits } from '@/lib/stripe/config';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Fetch user profile for subscription tier
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, subscription_period_end')
    .eq('id', user.id)
    .single();

  const tier = (profile?.subscription_tier ?? 'free') as string;
  const limits = getPlanLimits(tier);

  // Fetch user's projects with flowsheet IDs (single query, no N+1)
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, description, created_at, flowsheets(id, created_at)')
    .order('updated_at', { ascending: false });

  const projectsWithFlowsheet = (projects ?? []).map((project) => {
    const flowsheets = (project.flowsheets ?? []) as { id: string; created_at: string }[];
    const sorted = [...flowsheets].sort((a, b) => a.created_at.localeCompare(b.created_at));
    return {
      ...project,
      flowsheetCount: flowsheets.length,
      firstFlowsheetId: sorted[0]?.id ?? null,
    };
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <h1 className="text-xl font-bold">
            Aqua<span className="text-primary">Sim</span>
          </h1>
          <div className="flex items-center gap-4">
            <Badge variant={tier === 'free' ? 'secondary' : 'default'} className="text-xs">
              {tier === 'enterprise' && <Crown className="mr-1 h-3 w-3" />}
              {tier === 'pro' && <Zap className="mr-1 h-3 w-3" />}
              {tier.charAt(0).toUpperCase() + tier.slice(1)}
            </Badge>
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <SubscriptionManager currentTier={tier} stripeConfigured={!!process.env.STRIPE_SECRET_KEY} />
            <ThemeToggle />
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="ghost" size="sm">Sign Out</Button>
            </form>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold">Projects</h2>
            <p className="text-muted-foreground">Design and simulate wastewater treatment processes</p>
          </div>
          {(projectsWithFlowsheet.length < limits.maxProjects) ? (
            <Link href="/project/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {projectsWithFlowsheet.length}/{limits.maxProjects} projects
              </span>
              <Link href="/dashboard">
                <Button variant="outline" size="sm" className="text-primary">
                  <Zap className="mr-1 h-3.5 w-3.5" />
                  Upgrade for more
                </Button>
              </Link>
            </div>
          )}
        </div>

        {projectsWithFlowsheet.length === 0 ? (
          <Card className="p-12 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-4">Create your first wastewater treatment project to get started.</p>
            <Link href="/project/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectsWithFlowsheet.map((project) => (
              <Card key={project.id} className="group hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <Link
                      href={
                        project.firstFlowsheetId
                          ? `/project/${project.id}/flowsheet/${project.firstFlowsheetId}`
                          : `/project/${project.id}`
                      }
                      className="flex-1"
                    >
                      <CardTitle className="text-lg hover:text-primary transition-colors cursor-pointer">
                        {project.name}
                      </CardTitle>
                    </Link>
                    <DeleteProjectButton projectId={project.id} projectName={project.name} />
                  </div>
                  {project.description && (
                    <CardDescription>{project.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{project.flowsheetCount} scenario{project.flowsheetCount !== 1 ? 's' : ''}</span>
                    <span>-</span>
                    <span>{new Date(project.created_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
