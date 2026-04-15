'use client';

import type { SimulationResults, AggregatedBoQ, WaterQuality } from '@repo/sim-engine';
import type { DwaDischargeStandard } from '@repo/design-library';

import { CoverSection } from './sections/01-cover';
import { ExecutiveSummarySection } from './sections/02-executive-summary';
import { DesignBasisSection } from './sections/03-design-basis';
import { ProcessDescriptionSection } from './sections/04-process-description';
import { SizingCalculationsSection } from './sections/05-sizing-calculations';
import { AerationDesignSection } from './sections/06-aeration-design';
import { EnergyAnalysisSection } from './sections/07-energy-analysis';
import { ConsumablesSection } from './sections/08-consumables';
import { BillOfQuantitiesSection } from './sections/09-bill-of-quantities';
import { EffluentComplianceSection } from './sections/10-effluent-compliance';
import { DisclaimerSection } from './sections/11-disclaimer';

export interface ProposalData {
  client?: { name?: string; project_code?: string; location?: string };
  designer?: { name?: string; title?: string; date?: string };
  executive_summary?: string;
  disclaimer?: string;
}

export interface ProposalProfile {
  full_name: string | null;
  company: string | null;
  company_logo_url: string | null;
  designer_title: string | null;
}

interface Props {
  proposalData: ProposalData;
  onChange: (data: ProposalData) => void;
  profile: ProposalProfile;
  results: SimulationResults | null;
  boq: AggregatedBoQ | null;
  effluentStream: WaterQuality | null;
  dischargeStandard: DwaDischargeStandard;
  flowsheetName: string;
  projectName: string;
}

export const DEFAULT_DISCLAIMER =
  'This design report is a preliminary engineering estimate produced by AquaSim v2. Final sizing, procurement, and construction must be confirmed by a registered professional engineer. Supplier prices are indicative and subject to quotation at the time of procurement.';

export function ProposalDocument(props: Props) {
  const {
    proposalData,
    onChange,
    profile,
    results,
    boq,
    effluentStream,
    dischargeStandard,
    flowsheetName,
    projectName,
  } = props;

  return (
    <article className="proposal-document bg-background text-foreground print:text-black print:bg-white">
      <CoverSection
        client={proposalData.client}
        designer={proposalData.designer}
        profile={profile}
        projectName={projectName}
        flowsheetName={flowsheetName}
        onChange={(client) => onChange({ ...proposalData, client })}
        onDesignerChange={(designer) => onChange({ ...proposalData, designer })}
      />
      <ExecutiveSummarySection
        narrative={proposalData.executive_summary ?? ''}
        onChange={(narrative) => onChange({ ...proposalData, executive_summary: narrative })}
        boq={boq}
        results={results}
      />
      <DesignBasisSection results={results} dischargeStandard={dischargeStandard} />
      <ProcessDescriptionSection />
      <SizingCalculationsSection results={results} />
      <AerationDesignSection results={results} />
      <EnergyAnalysisSection results={results} />
      <ConsumablesSection results={results} />
      <BillOfQuantitiesSection boq={boq} />
      <EffluentComplianceSection effluentStream={effluentStream} dischargeStandard={dischargeStandard} />
      <DisclaimerSection
        text={proposalData.disclaimer ?? DEFAULT_DISCLAIMER}
        onChange={(disclaimer) => onChange({ ...proposalData, disclaimer })}
      />
    </article>
  );
}
