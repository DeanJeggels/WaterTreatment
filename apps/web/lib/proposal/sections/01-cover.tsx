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

export function CoverSection(_props: Props) {
  return (
    <section className="mb-10">
      <p className="text-muted-foreground italic">Cover page — populated in Task 6.</p>
    </section>
  );
}
