import { Database, Layers, Package, Map as MapIcon } from 'lucide-react'
import { MODES } from '@/lib/cbpHelpers'

const FIELDS_MONTHLY = [
  { key: 'ID', desc: 'Unique identifier (Year-Month-Crossing-ModeAbbr slug).' },
  { key: 'Year / Month', desc: 'Calendar year and month of the crossing count.' },
  { key: 'Region', desc: 'CBP field office region — El Paso, Laredo, or Rio Grande Valley (Pharr).' },
  { key: 'POE', desc: 'Port of Entry that administers the crossing.' },
  { key: 'Crossing', desc: 'Named crossing (34 bridges/ferries total along the Texas-Mexico border).' },
  { key: 'Modes', desc: 'Transportation mode — one of the five canonical values.' },
  { key: 'Northbound Crossing', desc: 'Count of northbound crossings for that Year × Month × Crossing × Mode.' },
]

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <div className="gradient-blue text-white relative overflow-visible">
        <div className="max-w-5xl mx-auto px-6 py-12 md:py-16 relative">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-balance">
            About the Data
          </h2>
          <p className="text-white/80 mt-3 text-base md:text-lg max-w-3xl">
            Northbound crossing counts at every Texas–Mexico port of entry for the last 10 years (2016–2025),
            compiled from data provided directly by U.S. Customs and Border Protection (CBP).
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
            most recent 10 years (2016–2025).
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
            The dashboard displays the most recent <strong>10 years (2016–2025)</strong>.
            Both tables share the same column set; yearly is the month-summed view of
            the monthly table.
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

        {/* ── Modes ───────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2.5 mb-3">
            <MapIcon size={20} className="text-brand-blue" />
            <h2 className="text-xl font-bold text-text-primary">Modes</h2>
          </div>
          <p className="text-lg text-text-secondary leading-relaxed mb-3">
            The dashboard uses a canonical five-mode vocabulary:
          </p>
          <ul className="space-y-1.5">
            {MODES.map((m) => (
              <li key={m} className="flex gap-3">
                <span className="mt-1.5 w-2 h-2 rounded-full bg-brand-blue flex-shrink-0" />
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
          <p className="text-lg text-text-secondary leading-relaxed mb-3">
            The raw CBP inputs (a master 2013–2024 workbook, a 2025 LRD/RGV
            workbook, and three 2025 El Paso field-office PDFs) are ingested
            through a five-step Python pipeline that normalizes crossing names,
            reconciles mode labels, sums rail containers into the
            <em> Railcars</em> mode, and produces two flat tables (monthly and
            yearly) covering the full 2008–2025 window. The dashboard loads
            those two tables directly and joins them to the authoritative list
            of 34 Texas–Mexico crossings (with lat/lon coordinates) for the
            maps.
          </p>
        </section>

      </div>
    </>
  )
}
