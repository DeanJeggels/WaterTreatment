'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  projectId: string;
  flowsheetId: string;
}

export function ProjectEditorTabs({ projectId, flowsheetId }: Props) {
  const pathname = usePathname();
  const base = `/project/${projectId}`;
  const flowsheetHref = `${base}/flowsheet/${flowsheetId}`;
  const proposalHref = `${base}/proposal/${flowsheetId}`;

  const isFlowsheet = pathname?.startsWith(`${base}/flowsheet/`) ?? false;
  const isProposal = pathname?.startsWith(`${base}/proposal/`) ?? false;

  return (
    <nav className="flex items-center gap-1 print:hidden" aria-label="Project editor tabs">
      <Link
        href={flowsheetHref}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
          isFlowsheet
            ? 'bg-accent text-accent-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        )}
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="hidden sm:inline">Flowsheet</span>
      </Link>
      <Link
        href={proposalHref}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
          isProposal
            ? 'bg-accent text-accent-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        )}
      >
        <FileText className="h-4 w-4" />
        <span className="hidden sm:inline">Proposal</span>
      </Link>
    </nav>
  );
}
