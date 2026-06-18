'use client';

import { useMemo, useState } from 'react';
import { getDwaLimits } from '@repo/design-library';
import {
  defaultInputs,
  validateInputs,
  type DesignInputs,
  type DischargeTier,
  type PlantType,
} from '@repo/auto-design';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * AquaSim v3 — Guided design wizard (T1.3). UI ONLY: it collects a DesignInputs,
 * validates live with @repo/auto-design validateInputs(), and hands the clean,
 * valid inputs to onSubmit. No engineering math happens here.
 */
interface Props {
  initialName?: string;
  onSubmit: (inputs: DesignInputs) => void | Promise<void>;
  submitting?: boolean;
}

type StepId = 'project' | 'influent' | 'targets' | 'review';
const STEPS: { id: StepId; title: string }[] = [
  { id: 'project', title: 'Project & flow' },
  { id: 'influent', title: 'Influent quality' },
  { id: 'targets', title: 'Targets & process' },
  { id: 'review', title: 'Review' },
];

export function DesignWizard({ initialName, onSubmit, submitting }: Props) {
  const [inputs, setInputs] = useState<DesignInputs>(() => {
    const base = defaultInputs('General');
    if (initialName) base.meta.projectName = initialName;
    return base;
  });
  const [stepIndex, setStepIndex] = useState(0);

  const validation = useMemo(() => validateInputs(inputs), [inputs]);
  const errorsByField = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const e of validation.errors) (map[e.field] ??= []).push(e.message);
    return map;
  }, [validation]);

  const step = STEPS[stepIndex]!;
  const isLast = stepIndex === STEPS.length - 1;

  function patch(p: Partial<DesignInputs>) {
    setInputs((prev) => ({ ...prev, ...p }));
  }
  function patchInfluent(p: Partial<DesignInputs['influent']>) {
    setInputs((prev) => ({ ...prev, influent: { ...prev.influent, ...p } }));
  }
  function patchMeta(p: Partial<DesignInputs['meta']>) {
    setInputs((prev) => ({ ...prev, meta: { ...prev.meta, ...p } }));
  }
  function setTier(tier: DischargeTier) {
    // Switching tier re-seeds the effluent targets from design-library.
    setInputs((prev) => ({ ...prev, dischargeStandard: tier, effluentTargets: getDwaLimits(tier) }));
  }

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Wizard steps">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStepIndex(i)}
              className={`rounded-full px-3 py-1 ${
                i === stepIndex ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {i + 1}. {s.title}
            </button>
            {i < STEPS.length - 1 && <span className="text-muted-foreground">→</span>}
          </li>
        ))}
      </ol>

      {step.id === 'project' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Project & design flow</CardTitle>
            <CardDescription>Who and how much. The flow drives every downstream size.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Project name" error={errorsByField['meta.projectName']} className="sm:col-span-2">
              <Input value={inputs.meta.projectName} onChange={(e) => patchMeta({ projectName: e.target.value })} />
            </Field>
            <Field label="Client (optional)">
              <Input value={inputs.meta.client ?? ''} onChange={(e) => patchMeta({ client: e.target.value })} />
            </Field>
            <Field label="Site location (optional)">
              <Input
                value={inputs.meta.siteLocation ?? ''}
                onChange={(e) => patchMeta({ siteLocation: e.target.value })}
              />
            </Field>
            <Field label="Design flow ADWF (m³/d)" error={errorsByField['designFlowM3d']}>
              <NumberInput value={inputs.designFlowM3d} onChange={(v) => patch({ designFlowM3d: v })} />
            </Field>
            <Field label="Peak factor (PWWF / ADWF)" error={errorsByField['peakFactor']}>
              <NumberInput value={inputs.peakFactor} step={0.1} onChange={(v) => patch({ peakFactor: v })} />
            </Field>
            <Field label="Available site area (m²)" error={errorsByField['siteAreaM2']} className="sm:col-span-2">
              <NumberInput value={inputs.siteAreaM2} onChange={(v) => patch({ siteAreaM2: v })} />
            </Field>
          </CardContent>
        </Card>
      )}

      {step.id === 'influent' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Influent quality</CardTitle>
            <CardDescription>Raw sewage characterisation. Prefilled with SA-typical values.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="COD (mg/L)" error={errorsByField['influent.COD']}>
              <NumberInput value={inputs.influent.COD} onChange={(v) => patchInfluent({ COD: v })} />
            </Field>
            <Field label="Soluble COD (mg/L)" error={errorsByField['influent.sCOD']}>
              <NumberInput value={inputs.influent.sCOD} onChange={(v) => patchInfluent({ sCOD: v })} />
            </Field>
            <Field label="TKN (mgN/L)" error={errorsByField['influent.TKN']}>
              <NumberInput value={inputs.influent.TKN} onChange={(v) => patchInfluent({ TKN: v })} />
            </Field>
            <Field label="NH₃-N (mgN/L)" error={errorsByField['influent.NH3N']}>
              <NumberInput value={inputs.influent.NH3N} onChange={(v) => patchInfluent({ NH3N: v })} />
            </Field>
            <Field label="Total P (mgP/L)" error={errorsByField['influent.TP']}>
              <NumberInput value={inputs.influent.TP} onChange={(v) => patchInfluent({ TP: v })} />
            </Field>
            <Field label="TSS (mg/L)" error={errorsByField['influent.TSS']}>
              <NumberInput value={inputs.influent.TSS} onChange={(v) => patchInfluent({ TSS: v })} />
            </Field>
            <Field label="Alkalinity (mg/L CaCO₃)" error={errorsByField['influent.alkalinity']}>
              <NumberInput value={inputs.influent.alkalinity ?? 0} onChange={(v) => patchInfluent({ alkalinity: v })} />
            </Field>
            <Field label="pH" error={errorsByField['influent.pH']}>
              <NumberInput value={inputs.influent.pH ?? 7} step={0.1} onChange={(v) => patchInfluent({ pH: v })} />
            </Field>
            <Field label="Design temp (°C)" error={errorsByField['influent.temperature']}>
              <NumberInput
                value={inputs.influent.temperature ?? 20}
                step={0.5}
                onChange={(v) => patchInfluent({ temperature: v })}
              />
            </Field>
          </CardContent>
        </Card>
      )}

      {step.id === 'targets' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Discharge target & process</CardTitle>
            <CardDescription>Effluent limits are sourced from the selected DWA tier.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Discharge standard">
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={inputs.dischargeStandard}
                onChange={(e) => setTier(e.target.value as DischargeTier)}
              >
                <option value="General">DWA General Limit</option>
                <option value="Special">DWA Special Limit</option>
              </select>
            </Field>
            <Field label="Plant type">
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={inputs.plantType}
                onChange={(e) => patch({ plantType: e.target.value as PlantType })}
              >
                <option value="MLE">MLE (Modified Ludzack-Ettinger)</option>
                <option value="MBR">MBR (membrane bioreactor)</option>
              </select>
            </Field>
            <div className="sm:col-span-2 flex flex-col gap-2 rounded-md border border-border p-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={inputs.preferences.pRemoval}
                  onChange={(e) =>
                    patch({ preferences: { ...inputs.preferences, pRemoval: e.target.checked } })
                  }
                />
                Chemical P-removal (ferric dosing)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={inputs.preferences.disinfection}
                  onChange={(e) =>
                    patch({ preferences: { ...inputs.preferences, disinfection: e.target.checked } })
                  }
                />
                UV disinfection (tertiary)
              </label>
            </div>
            <div className="sm:col-span-2 text-xs text-muted-foreground">
              Effluent targets — COD ≤ {inputs.effluentTargets.COD} · TSS ≤ {inputs.effluentTargets.TSS} · NH₃-N ≤{' '}
              {inputs.effluentTargets.NH3N} · TP ≤ {inputs.effluentTargets.TP} mg/L
            </div>
          </CardContent>
        </Card>
      )}

      {step.id === 'review' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Review</CardTitle>
            <CardDescription>
              {validation.valid ? 'All inputs valid — ready to generate the design.' : 'Resolve the issues below.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <dl className="grid grid-cols-2 gap-2">
              <Summary k="Project" v={inputs.meta.projectName || '—'} />
              <Summary k="Plant type" v={inputs.plantType} />
              <Summary k="Design flow" v={`${inputs.designFlowM3d} m³/d`} />
              <Summary k="Peak factor" v={String(inputs.peakFactor)} />
              <Summary k="Discharge" v={inputs.dischargeStandard} />
              <Summary k="Site area" v={`${inputs.siteAreaM2} m²`} />
            </dl>
            {!validation.valid && (
              <ul className="list-disc space-y-1 rounded-md border border-destructive/50 bg-destructive/10 p-3 pl-6 text-destructive">
                {validation.errors.map((e, i) => (
                  <li key={i}>{e.message}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={stepIndex === 0} onClick={() => setStepIndex((i) => Math.max(0, i - 1))}>
          Back
        </Button>
        {!isLast ? (
          <Button onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}>Next</Button>
        ) : (
          <Button
            disabled={!validation.valid || submitting}
            onClick={() => onSubmit(inputs)}
            title={validation.valid ? 'Generate design' : 'Resolve validation errors first'}
          >
            {submitting ? 'Generating…' : 'Generate design'}
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string[];
  className?: string;
  children: React.ReactNode;
}) {
  // Native <label> wrapping the control => implicit association (a11y + getByLabel).
  return (
    <label className={`block space-y-1.5 ${className ?? ''}`}>
      <span className="text-sm font-medium leading-none">{label}</span>
      {children}
      {error?.length ? <p className="text-xs text-destructive">{error[0]}</p> : null}
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  step,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      step={step ?? 1}
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
    />
  );
}

function Summary({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
