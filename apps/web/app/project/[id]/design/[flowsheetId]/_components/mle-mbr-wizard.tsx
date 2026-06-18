'use client';

import { useMemo, useState } from 'react';
import { defaultMleMbrInputs, type MleMbrInputs } from '@repo/auto-design';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * MLE-MBR design wizard. Collects the small input set (the engine derives the
 * rest) and hands a valid MleMbrInputs to onSubmit. UI only — no math.
 */
interface Props {
  initialName?: string;
  initialClient?: string;
  initialLocation?: string;
  onSubmit: (inputs: MleMbrInputs) => void | Promise<void>;
  submitting?: boolean;
}

export function MleMbrWizard({ initialName, initialClient, initialLocation, onSubmit, submitting }: Props) {
  const [v, setV] = useState<MleMbrInputs>(() => {
    const base = defaultMleMbrInputs();
    if (initialName) base.meta.projectName = initialName;
    if (initialClient) base.meta.client = initialClient;
    if (initialLocation) base.meta.siteLocation = initialLocation;
    return base;
  });

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!v.meta.projectName.trim()) e.push('Project name is required.');
    if (!(v.adwfM3d > 0)) e.push('ADWF must be greater than 0.');
    if (!(v.codMgL > 0)) e.push('Influent COD must be greater than 0.');
    if (!(v.tminC < v.tmaxC)) e.push('Minimum temperature must be below maximum.');
    if (!(v.siteAreaM2 > 0)) e.push('Site area must be greater than 0.');
    return e;
  }, [v]);

  const set = (p: Partial<MleMbrInputs>) => setV((prev) => ({ ...prev, ...p }));
  const setMeta = (p: Partial<MleMbrInputs['meta']>) => setV((prev) => ({ ...prev, meta: { ...prev.meta, ...p } }));
  const num = (val: number, on: (n: number) => void, step = 1) => (
    <Input type="number" inputMode="decimal" step={step} value={Number.isFinite(val) ? val : ''} onChange={(e) => on(e.target.value === '' ? 0 : Number(e.target.value))} />
  );
  const select = <T extends string>(val: T, opts: [T, string][], on: (x: T) => void) => (
    <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={val} onChange={(e) => on(e.target.value as T)}>
      {opts.map(([k, label]) => (<option key={k} value={k}>{label}</option>))}
    </select>
  );
  const check = (val: boolean, label: string, on: (b: boolean) => void) => (
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={val} onChange={(e) => on(e.target.checked)} />{label}</label>
  );
  const Field = ({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) => (
    <label className={`block space-y-1.5 ${className ?? ''}`}><span className="text-sm font-medium leading-none">{label}</span>{children}</label>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Project & site</CardTitle>
          <CardDescription>Identify the project and the available plot.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Project name" className="sm:col-span-2"><Input value={v.meta.projectName} onChange={(e) => setMeta({ projectName: e.target.value })} /></Field>
          <Field label="Client (optional)"><Input value={v.meta.client ?? ''} onChange={(e) => setMeta({ client: e.target.value })} /></Field>
          <Field label="Site location (optional)"><Input value={v.meta.siteLocation ?? ''} onChange={(e) => setMeta({ siteLocation: e.target.value })} /></Field>
          <Field label="Site area (m²)">{num(v.siteAreaM2, (n) => set({ siteAreaM2: n }))}</Field>
          <Field label="Site elevation (m AMSL)">{num(v.elevationM, (n) => set({ elevationM: n }))}</Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Flow, load & temperature</CardTitle>
          <CardDescription>The engine derives all influent quality from COD + land use.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="ADWF (m³/d)">{num(v.adwfM3d, (n) => set({ adwfM3d: n }))}</Field>
          <Field label="Influent COD (mg/L)">{num(v.codMgL, (n) => set({ codMgL: n }))}</Field>
          <Field label="Land use / influent type">{select(v.landUse, [['residential', 'Residential'], ['commercial', 'Commercial'], ['shopping_centre', 'Shopping centre'], ['hospital', 'Hospital'], ['industrial', 'Industrial']], (x) => set({ landUse: x }))}</Field>
          <Field label="Min temperature (°C)">{num(v.tminC, (n) => set({ tminC: n }), 0.5)}</Field>
          <Field label="Max temperature (°C)">{num(v.tmaxC, (n) => set({ tmaxC: n }), 0.5)}</Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Treatment objectives</CardTitle>
          <CardDescription>Drives process selection, sludge age and MLSS.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Discharge standard">{select(v.dischargeStandard, [['General', 'DWA General Limits'], ['Special', 'DWA Special Limits']], (x) => set({ dischargeStandard: x }))}</Field>
          <Field label="Membrane model">{select(v.membraneModel, [['megavision', 'Megavision (hollow fibre)'], ['memstar', 'Memstar (hollow fibre)']], (x) => set({ membraneModel: x }))}</Field>
          <div className="sm:col-span-2 flex flex-col gap-2 rounded-md border border-border p-3">
            {check(v.nitrogenRemoval, 'Nitrogen removal required', (b) => set({ nitrogenRemoval: b }))}
            {check(v.phosphorusRemoval, 'Phosphorus removal required', (b) => set({ phosphorusRemoval: b }))}
            {check(v.mbrRequired, 'MBR required (membranes inside the aeration tank)', (b) => set({ mbrRequired: b }))}
          </div>
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <ul className="list-disc space-y-1 rounded-md border border-destructive/50 bg-destructive/10 p-3 pl-6 text-sm text-destructive">
          {errors.map((e, i) => (<li key={i}>{e}</li>))}
        </ul>
      )}

      <div className="flex justify-end">
        <Button disabled={errors.length > 0 || submitting} onClick={() => onSubmit(v)}>
          {submitting ? 'Generating…' : 'Generate MLE-MBR design'}
        </Button>
      </div>
    </div>
  );
}
