'use client';

import { loadList } from '@repo/export-kit';
import type { DesignPackage, EngineeringObject } from '@repo/object-model';
import { LayoutSvg } from './layout-svg';

/**
 * DesignReport (T6.4) — the full, package-driven design report. Print-only
 * (`hidden print:block`): it IS the PDF target via window.print(). Every section
 * renders the persisted DesignPackage verbatim, so the PDF can never disagree
 * with the JSON/Excel. No new PDF dependency.
 */
const zar = (n: number) => `R ${Math.round(n).toLocaleString('en-ZA')}`;

interface BoqItem {
  description?: string;
  quantity?: number;
  unit?: string;
  unitPriceZar?: number;
  totalPriceZar?: number;
  sourceCitation?: string;
}

function dims(o: EngineeringObject): string {
  const g = o.geometry;
  if (g.shape === 'circle' && g.diameterM) return `Ø${g.diameterM.value} m × ${g.heightM?.value ?? '—'} m`;
  return `${g.footprint.lengthM} × ${g.footprint.widthM}${g.heightM ? ` × ${g.heightM.value}` : ''} m`;
}

function duty(o: EngineeringObject): string {
  const p = o.params;
  switch (p.kind) {
    case 'tank':
      return `${p.function}, ${p.volumeM3.value} ${p.volumeM3.unit}`;
    case 'blower':
      return `${p.airFlowAm3H.value} ${p.airFlowAm3H.unit} @ ${p.dischargePressureKpa.value} kPa, ${p.installedKW.value} kW, ${p.configuration}`;
    case 'pump':
      return `${p.dutyFlowM3H.value} ${p.dutyFlowM3H.unit} @ ${p.headM.value} m, ${p.installedKW.value} kW`;
    case 'dosing_skid':
      return `${p.chemical}, ${p.doseMgL.value} mg/L`;
    case 'screen':
      return `${p.screenType}, ${p.apertureMm.value} mm`;
    default:
      return p.equipmentType ?? '';
  }
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 break-inside-avoid">
      <h2 className="mb-3 border-b border-black/20 pb-1 text-base font-semibold">
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}

function KV({ rows }: { rows: [string, string][] }) {
  return (
    <table className="w-full text-xs">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-black/10">
            <td className="w-1/3 py-1 pr-4 text-gray-600">{k}</td>
            <td className="py-1 font-medium">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b border-black/30 py-1 pr-3 text-left font-semibold">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="border-b border-black/10 py-1 pr-3 align-top">{children}</td>;
}

export function DesignReport({ pkg }: { pkg: DesignPackage }) {
  const loads = loadList(pkg);
  const date = pkg.meta.generatedAt?.slice(0, 10) ?? '';

  return (
    <div className="hidden bg-white text-black print:block">
      {/* Cover */}
      <section className="mb-10 break-after-page">
        <div className="text-xs uppercase tracking-widest text-gray-500">Preliminary Wastewater Treatment Plant Design</div>
        <h1 className="mt-2 text-3xl font-bold">{pkg.meta.projectName || 'Untitled project'}</h1>
        <div className="mt-1 text-lg text-gray-700">
          {pkg.meta.client ?? '—'}
          {pkg.meta.siteLocation ? ` · ${pkg.meta.siteLocation}` : ''}
        </div>
        <div className="mt-6 inline-block rounded border border-black/20 px-3 py-1 text-sm font-semibold">
          {pkg.meta.plantType} train · Compliance {pkg.compliance.pass ? 'PASS' : 'REVIEW'}
        </div>
        <div className="mt-8 grid grid-cols-3 gap-4 text-sm">
          <div className="rounded border border-black/15 p-3">
            <div className="text-xs text-gray-500">Capex (preliminary)</div>
            <div className="text-lg font-semibold">{zar(pkg.totals.capexZar)}</div>
          </div>
          <div className="rounded border border-black/15 p-3">
            <div className="text-xs text-gray-500">Installed power</div>
            <div className="text-lg font-semibold">{pkg.totals.installedKW} kW</div>
          </div>
          <div className="rounded border border-black/15 p-3">
            <div className="text-xs text-gray-500">Footprint</div>
            <div className="text-lg font-semibold">{Math.round(pkg.totals.footprintM2).toLocaleString('en-ZA')} m²</div>
          </div>
        </div>
        <div className="mt-10 text-xs text-gray-500">
          Generated {date} · schema {pkg.schemaVersion} · sim-engine {pkg.meta.engine.simEngine} · layout {pkg.meta.engine.layout}
        </div>
      </section>

      <Section n={1} title="Basis of design">
        <KV
          rows={[
            ['Average dry-weather flow', `${pkg.basis.designFlows.adwf} m³/d`],
            ['Peak wet-weather flow', `${pkg.basis.designFlows.pwwf} m³/d`],
            ['Discharge standard', pkg.compliance.standard],
            ['Influent COD / TKN / TSS', `${pkg.basis.influentBasis.COD} / ${pkg.basis.influentBasis.TKN} / ${pkg.basis.influentBasis.TSS} mg/L`],
            ['Influent NH₃-N / TP', `${pkg.basis.influentBasis.NH3N} / ${pkg.basis.influentBasis.TP} mg/L`],
          ]}
        />
      </Section>

      <Section n={2} title="Process description">
        <p className="text-xs leading-relaxed">
          A {pkg.meta.plantType} activated-sludge train treating {pkg.basis.designFlows.adwf} m³/d. The process
          comprises, in flow order: {pkg.objects.map((o) => o.label).join(' → ')}. Every unit is sized by the
          deterministic engine; the layout below places each on the site by reviewable rules.
        </p>
      </Section>

      <Section n={3} title="Sizing schedule">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <Th>Tag</Th>
              <Th>Unit</Th>
              <Th>Dimensions</Th>
              <Th>Capacity / duty</Th>
            </tr>
          </thead>
          <tbody>
            {pkg.objects.map((o) => (
              <tr key={o.id}>
                <Td>{o.tag}</Td>
                <Td>{o.label}</Td>
                <Td>{dims(o)}</Td>
                <Td>{duty(o)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section n={4} title="Plant layout">
        <div className="break-inside-avoid">
          <LayoutSvg objects={pkg.objects} layout={pkg.layout} />
        </div>
      </Section>

      <Section n={5} title="Equipment schedule">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <Th>Tag</Th>
              <Th>Description</Th>
              <Th>Discipline</Th>
              <Th>Material</Th>
              <Th>Duty</Th>
            </tr>
          </thead>
          <tbody>
            {pkg.objects.map((o) => (
              <tr key={o.id}>
                <Td>{o.tag}</Td>
                <Td>{o.label}</Td>
                <Td>{o.discipline}</Td>
                <Td>{o.material.primary}</Td>
                <Td>{duty(o)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section n={6} title="Bill of quantities">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <Th>Category</Th>
              <Th>Description</Th>
              <Th>Qty</Th>
              <Th>Unit</Th>
              <Th>Total (ZAR)</Th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(pkg.boq.lineItemsByCategory).flatMap(([cat, items]) =>
              (items as BoqItem[]).map((it, i) => (
                <tr key={`${cat}-${i}`}>
                  <Td>{cat}</Td>
                  <Td>{it.description ?? '—'}</Td>
                  <Td>{it.quantity ?? ''}</Td>
                  <Td>{it.unit ?? ''}</Td>
                  <Td>{it.totalPriceZar !== undefined ? zar(it.totalPriceZar) : ''}</Td>
                </tr>
              )),
            )}
            <tr>
              <Td>
                <strong>Grand total</strong>
              </Td>
              <Td>{''}</Td>
              <Td>{''}</Td>
              <Td>{''}</Td>
              <Td>
                <strong>{zar(pkg.boq.grandTotalZar)}</strong>
              </Td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section n={7} title="Energy / load list">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <Th>Tag</Th>
              <Th>Equipment</Th>
              <Th>VFD</Th>
              <Th>Installed kW</Th>
            </tr>
          </thead>
          <tbody>
            {loads.rows.map((r) => (
              <tr key={r.tag}>
                <Td>{r.tag}</Td>
                <Td>{r.label}</Td>
                <Td>{r.vfd ? 'Yes' : '—'}</Td>
                <Td>{r.installedKW}</Td>
              </tr>
            ))}
            <tr>
              <Td>
                <strong>Total</strong>
              </Td>
              <Td>{''}</Td>
              <Td>{''}</Td>
              <Td>
                <strong>{loads.totalKW} kW</strong>
              </Td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section n={8} title="Compliance">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <Th>Parameter</Th>
              <Th>Predicted</Th>
              <Th>Target</Th>
              <Th>Result</Th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(pkg.compliance.perParameter).map(([param, v]) => (
              <tr key={param}>
                <Td>{param}</Td>
                <Td>{v.predicted}</Td>
                <Td>{v.target}</Td>
                <Td>{v.pass ? 'PASS' : 'FAIL'}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section n={9} title="Calculation trail">
        <table className="w-full text-[10px]">
          <thead>
            <tr>
              <Th>Quantity</Th>
              <Th>Equation</Th>
              <Th>Result</Th>
              <Th>Citation</Th>
            </tr>
          </thead>
          <tbody>
            {pkg.provenance.calculations.map((r, i) => (
              <tr key={i}>
                <Td>{r.label}</Td>
                <Td>{r.equation}</Td>
                <Td>
                  {r.result.value} {r.result.unit}
                </Td>
                <Td>{r.citation}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
