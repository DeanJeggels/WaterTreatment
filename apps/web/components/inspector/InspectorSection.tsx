import { cn } from '@/lib/utils';

interface Props {
  title: string;
  description?: string;
  children: React.ReactNode;
  variant?: 'default' | 'destructive';
  className?: string;
}

export function InspectorSection({
  title,
  description,
  children,
  variant = 'default',
  className,
}: Props) {
  return (
    <section
      className={cn(
        'space-y-2',
        variant === 'destructive' && 'rounded-md border border-destructive/50 bg-destructive/5 p-3',
        className,
      )}
    >
      <div>
        <h4
          className={cn(
            'text-xs font-medium uppercase tracking-wide',
            variant === 'destructive' ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {title}
        </h4>
        {description && (
          <p className="mt-0.5 text-[11px] text-muted-foreground/80">{description}</p>
        )}
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}
