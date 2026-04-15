import { cn } from '@/lib/utils';
import type { ProposalProfile, ProposalData } from '../ProposalDocument';

interface Props {
  client?: ProposalData['client'];
  designer?: ProposalData['designer'];
  profile: ProposalProfile;
  projectName: string;
  flowsheetName: string;
  onChange: (client: ProposalData['client']) => void;
  onDesignerChange: (designer: ProposalData['designer']) => void;
}

export function CoverSection(props: Props) {
  const { client, designer, profile, projectName, flowsheetName, onChange, onDesignerChange } = props;
  const today = new Date().toISOString().split('T')[0];

  return (
    <section className="mb-10 print:h-[90vh] flex flex-col justify-between">
      <div>
        {profile.company_logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.company_logo_url}
            alt={profile.company ?? ''}
            className="h-12 mb-8"
          />
        )}
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
          Wastewater Treatment Plant Design
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          <EditableSpan
            value={client?.name ?? ''}
            placeholder="[ Client name ]"
            onChange={(v) => onChange({ ...client, name: v })}
          />
        </h1>
        <div className="mt-2 text-lg text-muted-foreground">
          <EditableSpan
            value={client?.project_code ?? ''}
            placeholder="[ Project code ]"
            onChange={(v) => onChange({ ...client, project_code: v })}
          />
          {' — '}
          <EditableSpan
            value={client?.location ?? ''}
            placeholder="[ Location ]"
            onChange={(v) => onChange({ ...client, location: v })}
          />
        </div>
        <div className="mt-1 text-sm text-muted-foreground italic">
          {projectName} / {flowsheetName}
        </div>
      </div>

      <div className="text-sm text-muted-foreground border-t border-border pt-4 mt-8">
        <div>
          Prepared by{' '}
          <EditableSpan
            value={designer?.name ?? profile.full_name ?? ''}
            placeholder="[ Designer name ]"
            onChange={(v) => onDesignerChange({ ...designer, name: v })}
            className="text-foreground"
          />
          {(designer?.title || profile.designer_title) && (
            <>
              {', '}
              <span>{designer?.title ?? profile.designer_title}</span>
            </>
          )}
        </div>
        {profile.company && <div>{profile.company}</div>}
        <div className="mt-1">
          <EditableSpan
            value={designer?.date ?? today}
            placeholder={today}
            onChange={(v) => onDesignerChange({ ...designer, date: v })}
          />
        </div>
      </div>
    </section>
  );
}

function EditableSpan({
  value,
  placeholder,
  onChange,
  className,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onChange(e.currentTarget.textContent ?? '')}
      className={cn(
        'outline-none focus:bg-accent/40 rounded px-0.5',
        !value && 'text-muted-foreground/60',
        className,
      )}
      data-placeholder={placeholder}
    >
      {value || placeholder}
    </span>
  );
}
