import { useMemo } from 'react'
import { Calendar, Database, Layers, Package, Map as MapIcon } from 'lucide-react'
import { MODES } from '@/lib/cbpHelpers'
import ModeIcon from '@/components/ui/ModeIcon'
import { useCrossingsStore } from '@/stores/crossingsStore'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const FIELDS_MONTHLY = [
  { key: 'ID', desc: 'Unique identifier (Year-Month-Crossing-ModeAbbr slug).' },
  { key: 'Year / Month', desc: 'Calendar year and month of the crossing count.' },
  { key: 'Region', desc: 'Texas Border region — El Paso, Laredo, or Rio Grande Valley (Pharr).' },
  { key: 'POE', desc: 'Port of Entry that administers the crossing.' },
  { key: 'Crossing', desc: 'Named crossing (34 bridges/ferries total along the Texas-Mexico border).' },
  { key: 'Modes', desc: 'Transportation mode — one of the five canonical values.' },
  { key: 'Northbound Crossing', desc: 'Count of northbound crossings for that Year × Month × Crossing × Mode.' },
]

export default function AboutPage() {
  const monthly = useCrossingsStore((s) => s.monthly)
  const monthlyStatus = useCrossingsStore((s) => s.monthlyStatus)
  const coords = useCrossingsStore((s) => s.coords)

  const coverage = useMemo(() => {
    if (monthlyStatus !== 'ready' || !monthly?.length) return []
    const earliest = new Map()
    for (const r of monthly) {
      const name = r.Crossing
      const y = r.Year
      const m = r.Month
      const v = r['Northbound Crossing']
      if (!name || !Number.isFinite(y) || !Number.isFinite(m)) continue
      if (!Number.isFinite(v) || v <= 0) continue
      const key = y * 12 + m
      const prev = earliest.get(name)
      if (!prev || key < prev.key) {
        earliest.set(name, { key, year: y, month: m, region: r.Region, poe: r.POE })
      }
    }
    const order = new Map()
    for (const c of coords || []) {
      const name = c.data_crossing_name || c.crossing_name
      if (!name) continue
      const o = Number.isFinite(c.order) ? c.order : null
      if (o == null) continue
      if (!order.has(name) || o < order.get(name)) order.set(name, o)
    }
    const rows = [...earliest.entries()].map(([crossing, v]) => ({ crossing, ...v }))
    rows.sort((a, b) => (order.get(a.crossing) ?? 1e9) - (order.get(b.crossing) ?? 1e9))
    return rows
  }, [monthly, monthlyStatus, coords])

  return (
    <>
      {/* Hero */}
      <div className="gradient-blue text-white relative overflow-visible">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-16 relative">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-balance">
            About the Data
          </h2>
          <p className="text-white/80 mt-3 text-base md:text-lg max-w-3xl">
            Northbound crossing counts at every Texas–Mexico border crossing from 2008
            through 2025, compiled from data provided directly by U.S. Customs and
            Border Protection (CBP). This page documents the data source, table structure,
            field definitions, mode vocabulary, and the processing pipeline behind the
            dashboard.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-10">

        {/* ── Data Source ──────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2.5 mb-3">
            <Database size={20} className="text-brand-blue" />
            <h2 className="text-xl font-bold text-text-primary">Data Source</h2>
          </div>
          <p className="text-lg text-text-secondary leading-relaxed">
            All counts in this dashboard come from data received directly from
            U.S. Customs and Border Protection (CBP), collected for the purpose of
            building the Texas–Mexico Border Crossings dashboard. CBP reports
            northbound crossings by bridge and mode on a monthly cadence; the
            underlying records were provided as workbooks and monthly PDF traffic
            summaries covering 2008 through 2025; this dashboard surfaces the
            full series from 2008 to 2025.
          </p>
        </section>

        {/* ── Data Structure ──────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2.5 mb-3">
            <Layers size={20} className="text-brand-blue" />
            <h2 className="text-xl font-bold text-text-primary">Data Structure</h2>
          </div>
          <p className="text-lg text-text-secondary leading-relaxed mb-4">
            The dashboard is driven by two tables — the same data at two levels of
            granularity:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="bg-surface-alt rounded-lg p-4">
              <h5 className="text-base font-semibold text-text-primary mb-1">Monthly</h5>
              <p className="text-lg text-text-secondary leading-relaxed">
                ~34,000 rows at <em>Year × Month × Crossing × Mode</em>. Used for
                seasonal patterns and month-level drill-downs.
              </p>
            </div>
            <div className="bg-surface-alt rounded-lg p-4">
              <h5 className="text-base font-semibold text-text-primary mb-1">Yearly</h5>
              <p className="text-lg text-text-secondary leading-relaxed">
                ~2,850 rows at <em>Year × Crossing × Mode</em>. Used for headline
                totals, trend lines, and cross-region comparisons.
              </p>
            </div>
          </div>
          <p className="text-lg text-text-secondary leading-relaxed">
            The dashboard displays the full series <strong>2008–2025</strong>. Both
            tables share the same column set; yearly is the month-summed view of the
            monthly table.
          </p>
        </section>

        {/* ── Fields ──────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2.5 mb-3">
            <Package size={20} className="text-brand-blue" />
            <h2 className="text-xl font-bold text-text-primary">Fields</h2>
          </div>
          <div className="space-y-2">
            {FIELDS_MONTHLY.map((f) => (
              <div key={f.key} className="bg-white rounded-lg border border-border-light px-4 py-3">
                <span className="text-base font-semibold text-text-primary">{f.key}</span>
                <span className="text-lg text-text-secondary leading-relaxed ml-2">— {f.desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Coverage per Crossing ──────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2.5 mb-3">
            <Calendar size={20} className="text-brand-blue" />
            <h2 className="text-xl font-bold text-text-primary">Coverage per Crossing</h2>
          </div>
          <p className="text-lg text-text-secondary leading-relaxed mb-4">
            CBP's records reach back to January 2008, but some crossings came
            online later. The month shown below is the first month of reported
            northbound activity in the source data — a proxy for when the
            crossing opened or began reporting to CBP. Crossings are listed
            north-to-south along the Texas–Mexico border.
          </p>
          {monthlyStatus === 'error' ? (
            <p className="text-base text-red-700 italic">
              Monthly coverage data failed to load.
            </p>
          ) : monthlyStatus !== 'ready' ? (
            <p className="text-base text-text-secondary/80 italic">
              Loading monthly coverage…
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border-light">
              <table className="w-full text-base">
                <thead className="bg-surface-alt text-text-primary">
                  <tr>
                    <th className="text-left font-semibold px-4 py-2">Crossing</th>
                    <th className="text-left font-semibold px-4 py-2">Region · POE</th>
                    <th className="text-left font-semibold px-4 py-2 whitespace-nowrap">Data since</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.map((r, i) => (
                    <tr key={r.crossing} className={i % 2 ? 'bg-surface-alt/50' : 'bg-white'}>
                      <td className="px-4 py-2 text-text-primary">{r.crossing}</td>
                      <td className="px-4 py-2 text-text-secondary">{r.region} · {r.poe}</td>
                      <td className="px-4 py-2 text-text-secondary whitespace-nowrap tabular-nums">
                        {MONTH_NAMES[r.month - 1]} {r.year}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Modes ───────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2.5 mb-3">
            <MapIcon size={20} className="text-brand-blue" />
            <h2 className="text-xl font-bold text-text-primary">Modes</h2>
          </div>
          <p className="text-lg text-text-secondary leading-relaxed mb-3">
            The dashboard uses a canonical five-mode vocabulary:
          </p>
          <ul className="space-y-2">
            {MODES.map((m) => (
              <li key={m} className="flex items-center gap-3">
                <ModeIcon mode={m} size={22} className="text-brand-blue" />
                <p className="text-lg text-text-secondary leading-relaxed">{m}</p>
              </li>
            ))}
          </ul>
          <p className="text-base text-text-secondary/80 leading-relaxed mt-3">
            CBP reports rail traffic as separate "Rail Containers Full" and
            "Rail Containers Empty" counts; these are summed into <em>Railcars</em>
            in the processed data. For the El Paso area, CBP reports BNSF and
            Union Pacific rail traffic as a single combined total — the map
            shows both bridges as pins, but both draw from the same data row.
          </p>
        </section>

        {/* ── Processing Summary ──────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2.5 mb-3">
            <Database size={20} className="text-brand-blue" />
            <h2 className="text-xl font-bold text-text-primary">Processing</h2>
          </div>
          <ol className="space-y-2 list-decimal pl-6 marker:text-brand-blue marker:font-semibold">
            <li className="text-lg text-text-secondary leading-relaxed pl-1">
              Request data from CBP via TxDOT (El Paso and Laredo).
            </li>
            <li className="text-lg text-text-secondary leading-relaxed pl-1">
              Extract data from PDF (El Paso) and Excel worksheet, and populate
              master spreadsheet by mode and bridge.
            </li>
            <li className="text-lg text-text-secondary leading-relaxed pl-1">
              Aggregate monthly data to annual.
            </li>
            <li className="text-lg text-text-secondary leading-relaxed pl-1">
              Develop dashboard visualizations.
            </li>
          </ol>
        </section>

      </div>
    </>
  )
}
