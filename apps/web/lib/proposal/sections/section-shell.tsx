import { cn } from '@/lib/utils';

interface Props {
  number: number;
  title: string;
  children: React.ReactNode;
  /** Add a page-break-before in print mode. True by default except section 1. */
  pageBreak?: boolean;
  className?: string;
}

export function SectionShell({ number, title, children, pageBreak = true, className }: Props) {
  return (
    <section
      className={cn(
        'mb-10',
        pageBreak && 'print:break-before-page',
        className,
      )}
    >
      <h2 className="mb-4 flex items-baseline gap-3 border-b border-border pb-2 text-xl font-semibold text-foreground">
        <span className="font-mono text-sm text-muted-foreground">
          {number.toString().padStart(2, '0')}
        </span>
        <span>{title}</span>
      </h2>
      <div className="space-y-4 text-sm leading-relaxed text-foreground">{children}</div>
    </section>
  );
}
