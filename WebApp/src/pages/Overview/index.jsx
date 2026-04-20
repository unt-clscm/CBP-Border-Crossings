import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, ArrowRight, TrendingUp, TrendingDown, Minus, Award, MapPin, PieChart as PieIcon,
} from 'lucide-react'
import { useCrossingsStore } from '@/stores/crossingsStore'
import { formatNumber, formatPercent, CHART_COLORS } from '@/lib/chartColors'
import { modeMix, topCrossings, yoyDelta } from '@/lib/cbpHelpers'
import { buildMapCrossings, aggregateByDataCrossing } from '@/hooks/useCrossingsMapData'
import ChartCard from '@/components/ui/ChartCard'
import SectionBlock from '@/components/ui/SectionBlock'
import StatCard from '@/components/ui/StatCard'
import BarChart from '@/components/charts/BarChart'
import DonutChart from '@/components/charts/DonutChart'
import CrossingsMap from '@/components/maps/CrossingsMap'
import { DL } from '@/lib/downloadColumns'

function compactNumber(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`
  return `${sign}${abs.toFixed(0)}`
}

export default function OverviewPage() {
  const status  = useCrossingsStore((s) => s.status)
  const yearly  = useCrossingsStore((s) => s.yearly)
  const coords  = useCrossingsStore((s) => s.coords)
  const maxYear = useCrossingsStore((s) => s.maxYear)
  const minYear = useCrossingsStore((s) => s.minYear)

  /* ── Latest-year aggregate ─────────────────────────────────────────── */
  const { latest, prior, delta, pct } = useMemo(
    () => yoyDelta(yearly, maxYear),
    [yearly, maxYear],
  )

  const topFiveCrossings = useMemo(
    () => topCrossings(yearly, maxYear, 5),
    [yearly, maxYear],
  )

  const modeData = useMemo(() => modeMix(yearly, maxYear), [yearly, maxYear])

  /* ── Map markers: 34 pins sized by total NB volume for latest year ─ */
  const mapMarkers = useMemo(() => {
    if (!coords?.length || !yearly?.length || maxYear == null) return []
    const totals = aggregateByDataCrossing(yearly, { year: maxYear })
    return buildMapCrossings(coords, totals)
  }, [coords, yearly, maxYear])

  /* ── Loading state ─────────────────────────────────────────────────── */
  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-base text-text-secondary">Loading CBP crossings data…</p>
        </div>
      </div>
    )
  }

  // Use the authoritative coordinate-file count (34) rather than deriving
  // from the latest-year rows, where CBP collapses BNSF + UP into a single
  // data row and would report 33. The map already shows both rail bridges
  // as separate pins.
  const crossingCount = coords?.length ?? 0
  const topLabel = topFiveCrossings[0]?.label ?? '—'
  const topValue = topFiveCrossings[0]?.value ?? 0
  const trendDir = pct == null ? 'neutral' : pct >= 0 ? 'up' : 'down'
  const trendLabel = pct == null ? '—' : `${formatPercent(pct)} vs ${maxYear - 1}`

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="gradient-blue text-white relative overflow-visible">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
          <div className="pt-7 pb-3 md:pt-9 md:pb-4">
            <h2 className="text-2xl md:text-3xl font-bold text-white text-balance">
              Texas–Mexico Border Crossings ({minYear || 2008}–{maxYear || 2025})
            </h2>
            <p className="text-white/80 mt-2 text-sm md:text-base leading-relaxed max-w-3xl">
              Northbound crossing counts at every Texas–Mexico port of entry, compiled from CBP data.
              Circle size shows total crossings for {maxYear}; color marks the CBP field-office region.
              Click a crossing to drill down.
            </p>
          </div>
          <div className="pb-4 md:pb-5">
            <div className="rounded-xl overflow-hidden shadow-lg ring-1 ring-white/10" style={{ height: 540 }}>
              {mapMarkers.length > 0 ? (
                <CrossingsMap crossings={mapMarkers} height="540px" metricLabel={`${maxYear} crossings`} />
              ) : (
                <div className="w-full h-full bg-white/5 flex items-center justify-center">
                  <p className="text-white/40 text-sm">Loading map data…</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Headline Stats ──────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-2">
        <section className="rounded-xl border border-border-light bg-surface-alt/50 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              label={`Total Northbound Crossings (${maxYear})`}
              value={formatNumber(latest)}
              icon={Users}
              highlight
              variant="primary"
              delay={0}
            />
            <StatCard
              label={`Year-over-Year Change`}
              value={pct == null ? '—' : `${pct >= 0 ? '+' : ''}${formatPercent(pct)}`}
              trend={trendDir}
              trendLabel={trendLabel}
              icon={pct == null ? Minus : pct >= 0 ? TrendingUp : TrendingDown}
              delay={100}
            />
            <StatCard
              label="Crossings in Texas"
              value={formatNumber(crossingCount)}
              icon={MapPin}
              delay={200}
            />
            <StatCard
              label={`Top Crossing (${maxYear})`}
              value={compactNumber(topValue)}
              trendLabel={topLabel}
              icon={Award}
              delay={300}
            />
          </div>
        </section>
      </div>

      {/* ── Mode Mix + Top-5 Crossings ──────────────────────────────── */}
      <SectionBlock alt>
        <div className="flex items-center gap-2.5 mb-5">
          <PieIcon size={20} className="text-brand-blue" />
          <h3 className="text-xl font-bold text-text-primary">
            {maxYear} Mix by Mode and Crossing
          </h3>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ChartCard
            title={`Mode Mix (${maxYear})`}
            subtitle="Share of total northbound crossings by mode"
            downloadData={{ summary: { data: modeData, filename: `mode-mix-${maxYear}`, columns: DL.modeRank } }}
          >
            <DonutChart
              data={modeData}
              nameKey="label"
              valueKey="value"
              formatValue={compactNumber}
            />
          </ChartCard>

          <ChartCard
            title={`Top 5 Crossings (${maxYear})`}
            subtitle="Total northbound crossings, all modes combined"
            downloadData={{ summary: { data: topFiveCrossings, filename: `top-crossings-${maxYear}`, columns: DL.crossingRank } }}
          >
            <BarChart
              data={topFiveCrossings}
              xKey="label"
              yKey="value"
              horizontal
              formatValue={compactNumber}
              colorAccessor={(d) => CHART_COLORS[topFiveCrossings.indexOf(d) % CHART_COLORS.length]}
            />
          </ChartCard>
        </div>
      </SectionBlock>

      {/* ── Navigation Cards ──────────────────────────────────────── */}
      <SectionBlock>
        <div className="flex items-center gap-2.5 mb-4">
          <ArrowRight size={20} className="text-brand-blue" />
          <h3 className="text-xl font-bold text-text-primary">Explore the Data</h3>
        </div>
        <p className="text-lg text-text-secondary leading-relaxed mb-5">
          Each page below offers a focused lens on Texas–Mexico crossings. Filters
          on each page support multi-year, multi-mode, and multi-region slicing.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            { path: '/by-crossing', title: 'By Crossing', desc: 'Time-series and drill-downs for any of the 34 individual crossings.' },
            { path: '/by-mode',     title: 'By Mode',     desc: 'Trends for each of the five modes across all crossings over the last 10 years.' },
            { path: '/by-region',   title: 'By Region',   desc: 'Side-by-side comparison of the El Paso, Laredo, and Rio Grande Valley field offices.' },
          ].map((p) => (
            <Link
              key={p.path}
              to={p.path}
              className="text-left relative rounded-xl border border-border-light bg-white p-6 flex flex-col
                         hover:shadow-md hover:-translate-y-0.5 hover:border-brand-blue/30
                         transition-all duration-200 group"
            >
              <div className="flex items-center gap-2.5 mb-2">
                <span className="text-base font-bold text-text-primary">{p.title}</span>
                <ArrowRight size={14} className="ml-auto text-text-secondary group-hover:text-brand-blue transition-colors" />
              </div>
              <p className="text-lg text-text-secondary leading-relaxed">{p.desc}</p>
            </Link>
          ))}
        </div>
      </SectionBlock>
    </>
  )
}
