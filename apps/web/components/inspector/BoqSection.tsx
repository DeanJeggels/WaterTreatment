import type { BoQLineItem, BoQCategory } from '@repo/sim-engine';
import { InspectorSection } from './InspectorSection';
import { Badge } from '@/components/ui/badge';

interface Props {
  capex?: { lineItems: BoQLineItem[]; total: number };
}

const CATEGORY_LABEL: Record<BoQCategory, string> = {
  civil: 'Civil',
  mechanical: 'Mech',
  electrical: 'Elec',
  chemicals: 'Chem',
  instrumentation: 'Instr',
};

export function BoqSection({ capex }: Props) {
  if (!capex || capex.lineItems.length === 0) return null;
  return (
    <InspectorSection
      title="Bill of Quantities"
      description="This unit's contribution to the plant BoQ"
    >
      <ul className="space-y-1.5 text-xs">
        {capex.lineItems.map((item, i) => (
          <li key={i} className="space-y-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0">
                  {CATEGORY_LABEL[item.category] ?? item.category}
                </Badge>
                <span className="text-foreground truncate">{item.description}</span>
              </div>
              <span className="font-mono text-foreground whitespace-nowrap">
                R{formatCurrency(item.quantity * item.unitPriceZar)}
              </span>
            </div>
            <div className="pl-[3.25rem] text-[10px] text-muted-foreground/80 italic">
              {item.sourceCitation}
            </div>
          </li>
        ))}
      </ul>
      <div className="pt-2 mt-2 border-t border-border flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground font-medium">Unit subtotal</span>
        <span className="font-mono text-foreground font-semibold">
          R{formatCurrency(capex.total)}
        </span>
      </div>
    </InspectorSection>
  );
}

function formatCurrency(v: number): string {
  return v.toLocaleString('en-ZA', { maximumFractionDigits: 0 });
}
