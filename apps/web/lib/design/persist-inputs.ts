import { createClient } from '@/lib/supabase/client';
import type { DesignInputs } from '@repo/auto-design';

/**
 * Persist a DesignInputs draft to design_packages (T1.4). The Supabase write
 * lives ONLY in apps/web; the headless packages never touch the DB. Writes the
 * replayable form to `inputs` and leaves `package` NULL until the design runs
 * (T5.3). Upserts on (flowsheet_id, version) so re-submitting updates the draft.
 */
export async function persistDesignInputs(
  projectId: string,
  flowsheetId: string,
  inputs: DesignInputs,
): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('design_packages')
    .upsert(
      {
        project_id: projectId,
        flowsheet_id: flowsheetId,
        version: 1,
        schema_version: '1.0.0',
        inputs,
        package: null,
        plant_type: inputs.plantType,
        compliance_pass: null,
        generated_by: user.id,
      },
      { onConflict: 'flowsheet_id,version' },
    )
    .select('id')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to save design inputs');
  return data.id as string;
}
