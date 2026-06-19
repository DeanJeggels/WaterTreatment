'use client';

import type { MleMbrDesign } from '@repo/sim-engine';
import type { DesignPackage } from '@repo/object-model';

/**
 * MLE-MBR preliminary design report — the master-spec 13-section engineering
 * document (+ JSON appendix + disclaimer), print-only (`hidden print:block`),
 * rendered VERBATIM from the persisted design (pkg.mleMbr) + objects + modelJson.
 * window.print() targets it.
 */
function Section({ n, title, children }: { n: number | string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7 break-inside-avoid">
      <h2 className="mb-2 border-b border-black/25 pb-1 text-base font-semibold">{n}. {title}</h2>
      {children}
    </section>
  );
}
function T({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-xs">
      <thead><tr>{head.map((h) => (<th key={h} className="border-b border-black/30 py-1 pr-3 text-left font-semibold">{h}</th>))}</tr></thead>
      <tbody>{rows.map((r, i) => (<tr key={i}>{r.map((c, j) => (<td key={j} className="border-b border-black/10 py-1 pr-3 align-top">{c}</td>))}</tr>))}</tbody>
    </table>
  );
}

const STANDARDS = [
  'Concrete C30/37 (blinding C15); 50 mm cover to the wastewater face; crack width ≤0.2 mm (BS 8007 / SANS 10100).',
  'Tank freeboard ≥300 mm; walls 200 mm to 3 m / 250 mm 3–5 m depth; 1:50 floor fall to a sump; 75 mm filleted internal corners.',
  'Pipe velocities — gravity 0.6–3.0, pressure 0.8–2.5, suction 0.5–1.2, air 10–20, chemical 0.5–1.5 m/s; min process pipe 25 mm, sludge 50 mm.',
  'Blowers 20% airflow margin + duty/standby; mandatory inlet filter, flexible connection, NRV, isolation valve, PRV; acoustic enclosure if >85 dBA.',
  'Pumps duty/standby (recirc/WAS single duty); submersibles on SS316 guide rails + chain + auto-coupling + dry-run protection; surface pumps iso/iso/NRV/gauge.',
  '1000 mm maintenance access on ≥1 side of every major item; 600 mm walkways; SS316 external + wastewater-contact fasteners; EPDM gaskets; no aluminium in wetted/chemical service.',
  'Chemical bund ≥110% of the largest tank; puddle flanges + annular seals at all penetrations; flotation check on buried structures; 600 mm cover (900 mm trafficked).',
];

export function MleMbrReport({ pkg }: { pkg: DesignPackage }) {
  if (!pkg.mleMbr) return null;
  const d = pkg.mleMbr as unknown as MleMbrDesign;
  const i = d.influent;
  const date = pkg.meta.generatedAt?.slice(0, 10) ?? '';
  const limits = pkg.basis.dischargeStandard as Record<string, number | undefined>;
  const detailed = pkg.objects.filter((o) => o.mechanical);
  const checks = detailed.flatMap((o) => o.mechanical!.standardsCompliance.map((s) => ({ id: o.mechanical!.equipmentId, ...s })));
  const passN = checks.filter((c) => c.status === 'pass').length;
  const warnN = checks.filter((c) => c.status === 'warn').length;
  const failN = checks.filter((c) => c.status === 'fail').length;
  const layoutOpts = (Array.isArray(pkg.layoutOptions) ? pkg.layoutOptions : []) as Array<Record<string, unknown>>;
  const model = pkg.modelJson as Record<string, unknown> | undefined;

  return (
    <div className="hidden bg-white text-black print:block">
      <section className="mb-8 break-after-page">
        <div className="text-xs uppercase tracking-widest text-gray-500">Preliminary MBR Wastewater Treatment Plant Design</div>
        <h1 className="mt-2 text-3xl font-bold">{pkg.meta.projectName || 'Untitled project'}</h1>
        <div className="mt-1 text-lg text-gray-700">{pkg.meta.client ?? '—'}{pkg.meta.siteLocation ? ` · ${pkg.meta.siteLocation}` : ''}</div>
        <div className="mt-3 text-sm text-gray-500">Generated {date} · {d.process.config}{d.mbr.included ? ' + MBR' : ''} · {pkg.compliance.standard}</div>
      </section>

      <Section n={1} title="Project overview">
        <p className="text-xs leading-relaxed">
          This preliminary design treats an average dry-weather flow of {d.flows.adwf} m³/d ({d.basis.landUse} influent, COD {i.COD} mg/L)
          to {pkg.compliance.standard} discharge quality. The selected process is a {d.process.config}
          {d.mbr.included ? ' membrane bioreactor (MBR), with the membranes located inside the aeration tank' : ''}, operated at {d.process.sludgeAgeDays}-day sludge age and
          {' '}{d.process.mlssMgL.toLocaleString()} mg/L MLSS. Final disinfection is by UV followed by sodium-hypochlorite dosing before treated-water discharge.
        </p>
      </Section>

      <Section n={2} title="Basis of design">
        <div className="grid grid-cols-2 gap-6">
          <T head={['Flow', 'm³/d']} rows={[['ADWF', d.flows.adwf], ['AWWF', d.flows.awwf], ['PDWF', d.flows.pdwf], ['PWWF', d.flows.pwwf]]} />
          <T head={['Influent', 'mg/L']} rows={[['COD', i.COD], ['BOD', i.BOD], ['TKN', i.TKN], ['FSA', i.FSA], ['TP', i.TP], ['OP', i.OP], ['TSS', i.TSS], ['ISS', i.ISS], ['FOG', i.FOG], ['Alkalinity', i.alkalinity]]} />
        </div>
        <div className="mt-3">
          <T head={['Effluent target', 'mg/L']} rows={[['COD', limits.COD ?? '—'], ['NH₃-N', limits.NH3N ?? '—'], ['NO₃-N', limits.NO3N ?? '—'], ['TSS', limits.TSS ?? '—'], ['TP', limits.TP ?? '—']]} />
        </div>
        <p className="mt-2 text-xs text-gray-600">Operating temperature {d.basis.tminC}–{d.basis.tmaxC} °C · site elevation {d.basis.elevationM} m AMSL · sewage return factor {d.flows.sewageReturnFraction}.</p>
      </Section>

      <Section n={3} title="Process selection and justification">
        <p className="text-xs leading-relaxed">
          {d.process.config === 'MLE' ? 'An MLE (Modified Ludzack-Ettinger) configuration is selected for nitrogen removal: buffer → anoxic → aeration tank with MBR → UV → chlorine dosing.'
            : d.process.config === 'A2O_UCT' ? 'A UCT/A²O configuration is selected for combined N + P removal.'
            : 'A straight aerobic configuration is selected (no nutrient removal required).'}
          {' '}Sludge age {d.process.sludgeAgeDays} d (min {d.process.minSludgeAgeDays} d), MLSS {d.process.mlssMgL.toLocaleString()} mg/L, {d.process.trains} reactor train(s),
          a-recycle {d.process.recycle.a}×Q and RAS {d.process.recycle.r}×Q.
        </p>
      </Section>

      <Section n={4} title="Bioreactor design">
        <T head={['Parameter', 'Value', 'Unit']} rows={[
          ['OHO biomass (Mbh)', d.reactor.sludgeMass.Mbh, 'kgVSS'],
          ['Endogenous residue (Mxeh)', d.reactor.sludgeMass.Mxeh, 'kgVSS'],
          ['Inert VSS (MXI)', d.reactor.sludgeMass.MXI, 'kgVSS'],
          ['Total VSS (MXv)', d.reactor.sludgeMass.MXv, 'kgVSS'],
          ['Total TSS (MXt)', d.reactor.sludgeMass.MXt, 'kgTSS'],
          ['Total reactor volume (selected)', d.reactor.volumeSelectedM3, 'm³'],
          ['Aerobic volume', d.reactor.aerobicVolumeM3, 'm³'],
          ['Anoxic volume', d.reactor.anoxicVolumeM3, 'm³'],
          ['Aerobic / anoxic HRT', `${d.reactor.aerobicHrtH} / ${d.reactor.anoxicHrtH}`, 'h'],
          ['Effluent NH₃-N / NO₃-N', `${d.effluent.ammoniaMgL} / ${d.effluent.nitrateMgL}`, 'mgN/L'],
          ['Nitrogen removal', d.effluent.nitrogenRemovalPct, '%'],
          ['Sludge waste rate', `${d.reactor.wasM3d} (${d.reactor.wasKgTssD} kgTSS/d)`, 'm³/d'],
        ]} />
      </Section>

      <Section n={5} title="Aeration design">
        <T head={['Parameter', 'Value', 'Unit']} rows={[
          ['Oxygen for OHOs (FOc)', d.aeration.o2OhoKgD, 'kgO/d'],
          ['Oxygen for nitrification (FOn)', d.aeration.o2NitrificationKgD, 'kgO/d'],
          ['Denitrification credit (FOdn)', d.aeration.o2DenitCreditKgD, 'kgO/d'],
          ['MBR air-scour O₂ credit', d.aeration.o2ScourCreditKgD, 'kgO/d'],
          ['Total oxygen demand (FOt)', d.aeration.o2TotalKgD, 'kgO/d'],
          ['Site-corrected OTE', (d.aeration.oteFraction * 100).toFixed(2), '%'],
          ['Process air supply', `${d.aeration.processAirNm3h} Nm³/h (${d.aeration.processAirAm3h} Am³/h)`, ''],
          ['Diffusers (fine-bubble)', d.aeration.diffuserCount, 'units'],
        ]} />
      </Section>

      <Section n={6} title="MBR design">
        <T head={['Parameter', 'Value', 'Unit']} rows={[
          ['Membrane', d.mbr.model, ''],
          ['Design flux', d.mbr.fluxLmh, 'LMH'],
          ['Membrane area required', d.mbr.membraneAreaM2, 'm²'],
          ['SMU modules', d.mbr.moduleCount, 'ea'],
          ['Air scour', `${d.mbr.airScourNm3h} Nm³/h (${d.mbr.airScourAm3h} Am³/h)`, ''],
          ['Permeate pump duty', d.mbr.permeateDutyM3h, 'm³/h'],
          ['CIP tank volume', d.mbr.cipTankM3, 'm³'],
        ]} />
      </Section>

      <Section n={7} title="Equipment list">
        <T head={['ID', 'Tag', 'Description', 'Duty/standby', 'L×W×H mm', 'Weight kg', 'Vendor']} rows={detailed.map((o) => {
          const m = o.mechanical!;
          const dm = m.dimensionsMm;
          return [m.equipmentId, o.tag, o.label, m.dutyStandby.configuration, `${dm.lengthMm ?? '—'}×${dm.widthMm ?? '—'}×${dm.heightMm ?? '—'}`, dm.weightKg ?? '—', m.vendor];
        })} />
        <p className="mt-2 text-[10px] text-gray-500">Full nozzle schedules, accessories and maintenance clearances per item are in the model data (Appendix). Vendor/model are indicative pending procurement.</p>
      </Section>

      <Section n={8} title="Tank sizing (two layout options)">
        <T head={['Tank', 'Vol m³', 'Option A (square)', 'Option B (2:1)']} rows={d.tanks.map((t) => [
          t.name, t.volumeM3,
          `${t.options[0].lengthM}×${t.options[0].widthM}×${t.options[0].depthM} m`,
          `${t.options[1].lengthM}×${t.options[1].widthM}×${t.options[1].depthM} m`,
        ])} />
      </Section>

      <Section n={9} title="Mechanical layout description">
        <p className="mb-1 text-xs">The selected optimised layout applies these installation-type and orientation rules:</p>
        <ul className="ml-4 list-disc text-xs leading-relaxed">
          {pkg.layout.rulesApplied.filter((r) => r.rule && r.rule.length > 30).map((r, k) => (<li key={k}>{r.rule}</li>))}
        </ul>
        {pkg.objects.some((o) => o.ext?.orientation) && (
          <table className="mt-2 w-full text-xs">
            <thead><tr><th className="border-b border-black/30 py-1 pr-3 text-left font-semibold">Equipment</th><th className="border-b border-black/30 py-1 pr-3 text-left font-semibold">Orientation</th></tr></thead>
            <tbody>{pkg.objects.filter((o) => o.ext?.orientation).map((o, k) => (
              <tr key={k}><td className="border-b border-black/10 py-1 pr-3 align-top">{o.mechanical?.equipmentId ?? o.tag}</td><td className="border-b border-black/10 py-1 pr-3 align-top">{String(o.ext!.orientation)}</td></tr>
            ))}</tbody>
          </table>
        )}
        {layoutOpts.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-1 text-sm font-semibold">Layout options considered (Stage 5 optimisation)</h3>
            <T head={['Option', 'Footprint m²', '% plot', 'Pipe m', 'Bends', 'Cross', 'Access', 'Score', 'Sel.']} rows={layoutOpts.map((o) => [String(o.label), Number(o.footprintM2), Number(o.footprintUsedPct), Number(o.pipeLengthM), Number(o.bendCount), Number(o.crossingCount), String(o.maintenanceAccess), Number(o.score), o.selected ? '✓' : ''])} />
            <ul className="ml-4 mt-1 list-disc text-[10px] leading-relaxed text-gray-600">
              {layoutOpts.map((o, k) => (<li key={k}><span className="font-semibold">{String(o.label)}:</span> {String(o.arrangementLogic)} <span className="italic">Trade-offs:</span> {String(o.tradeoffs)} Best for {String(o.bestForPriority)}. Clearances: {String(o.clearanceCompromises)}.</li>))}
            </ul>
            <p className="mt-1 text-[10px] text-gray-500">Lower score = better for the selected client priority. The selected option drives the persisted layout, 2D plan and 3D model; process parameters, equipment specs and pipe sizes are locked — only positions/orientations vary between options.</p>
          </div>
        )}
      </Section>

      <Section n={10} title="Solids handling">
        <p className="mb-2 text-xs">Waste activated sludge is drawn from the membrane tank at MLSS concentration by the WAS pump to the thickening silo; recommended thickening: {d.solids.thickening}; dewatering: {d.solids.dewatering}.</p>
        <T head={['Parameter', 'Value', 'Unit']} rows={[['WAS rate', d.solids.wasM3d, 'm³/d'], ['WAS TSS', d.solids.wasTssMgL.toLocaleString(), 'mg/L'], ['WAS VSS', d.solids.wasVssMgL.toLocaleString(), 'mg/L'], ['Thickening silo volume', d.solids.thickeningSiloM3, 'm³']]} />
      </Section>

      <Section n={11} title="Utilities summary">
        <T head={['Parameter', 'Value', 'Unit']} rows={[
          ['Installed power', d.utilities.installedKW, 'kW'],
          ['Duty power', d.utilities.dutyKW, 'kW'],
          ['Specific energy', d.utilities.energyKwhPerM3, 'kWh/m³'],
          ['Sodium hypochlorite (daily)', d.utilities.naoclLPerDay, 'L/d'],
          ['Sodium hypochlorite (hourly)', d.utilities.naoclLPerHour, 'L/h'],
          [`NaOCl bulk storage (${d.utilities.naoclStorageDays} d)`, d.utilities.naoclStorageM3, 'm³'],
          ['CIP acid', d.utilities.cipAcidLPerDay, 'L/d'],
          ['Service water', d.utilities.serviceWaterM3d, 'm³/d'],
        ]} />
      </Section>

      <Section n={12} title="Design summary">
        <T head={['Parameter', 'Value', 'Unit']} rows={[
          ['Process', d.process.config + (d.mbr.included ? ' + MBR' : ''), ''],
          ['ADWF', d.flows.adwf, 'm³/d'],
          ['Sludge age', d.process.sludgeAgeDays, 'd'],
          ['MLSS', d.process.mlssMgL.toLocaleString(), 'mg/L'],
          ['Total reactor volume', d.reactor.volumeSelectedM3, 'm³'],
          ['Aerobic / anoxic volume', `${d.reactor.aerobicVolumeM3} / ${d.reactor.anoxicVolumeM3}`, 'm³'],
          ['Membrane area / modules', `${d.mbr.membraneAreaM2} / ${d.mbr.moduleCount}`, 'm² / ea'],
          ['Process air / scour', `${d.aeration.processAirAm3h} / ${d.mbr.airScourAm3h}`, 'Am³/h'],
          ['Diffusers', d.aeration.diffuserCount, 'units'],
          ['Installed power', d.utilities.installedKW, 'kW'],
          ['N removal', d.effluent.nitrogenRemovalPct, '%'],
          ['NaOCl dosing', d.utilities.naoclLPerDay, 'L/d'],
        ]} />
      </Section>

      <Section n={13} title="Standards compliance">
        <p className="mb-1 text-xs">Mechanical &amp; civil standards enforced on this design:</p>
        <ul className="ml-4 list-disc text-[10px] leading-relaxed">{STANDARDS.map((s, k) => (<li key={k}>{s}</li>))}</ul>
        <p className="mb-1 mt-3 text-xs">Per-item compliance check — <span className="font-semibold text-green-700">{passN} pass</span>{warnN ? <span className="font-semibold text-amber-700"> · {warnN} warn</span> : null}{failN ? <span className="font-semibold text-red-700"> · {failN} fail</span> : null}:</p>
        <T head={['ID', 'Check', 'Status', 'Note']} rows={checks.map((c) => [c.id, c.check, c.status === 'pass' ? '✓ pass' : c.status === 'warn' ? '⚠ warn' : '✗ fail', c.note ?? ''])} />
      </Section>

      <Section n="Appendix" title="Full equipment data model (JSON)">
        {model ? (
          <>
            <p className="mb-1 text-[10px] text-gray-600">
              Schema {String(model.schema)} · {(model.equipment as unknown[])?.length ?? 0} equipment items · {(model.pipework as unknown[])?.length ?? 0} pipe runs.
              The complete machine-readable model below is the source of truth for the 3D/BIM rendering engine (also available via the JSON export).
            </p>
            <pre className="overflow-hidden whitespace-pre-wrap break-all border border-black/15 p-2 text-[6px] leading-tight">{JSON.stringify(model, null, 1)}</pre>
          </>
        ) : (
          <p className="text-[10px] text-gray-500">Model data is available via the JSON export.</p>
        )}
      </Section>

      {d.warnings.length > 0 && (
        <div className="mb-4 rounded border border-amber-400 bg-amber-50 p-3 text-xs text-amber-900">
          {d.warnings.map((w, k) => (<div key={k}>⚠ {w}</div>))}
        </div>
      )}

      <p className="mt-6 border-t border-black/20 pt-3 text-[10px] italic text-gray-600">
        This design is preliminary and based on estimated influent quality and standard engineering assumptions. Detailed design must follow upon formal
        appointment and receipt of confirmed site data, geotechnical investigation results, and actual water quality sample results. All designs require
        review and sign-off by a registered professional engineer before implementation.
      </p>
    </div>
  );
}
