/**
 * ── ByRegion page ───────────────────────────────────────────────────────
 * Side-by-side comparison of CBP's three Texas–Mexico field-office regions
 * (El Paso → Laredo → Rio Grande Valley, north-to-south).
 *
 * Layout:
 *   - Hero title strip
 *   - Three region panels (stacked on mobile, 3-column grid on xl):
 *       • Region header with total crossings + active crossings for the
 *         filtered window.
 *       • StackedBarChart of yearly crossings broken down by mode.
 *       • Inline mode-share bar for the latest year in the filtered range.
 *   - Full-border map (all 34 pins, colored by region palette).
 *
 * Filters (sidebar, via DashboardLayout):
 *   - Year range (2008–2025)
 *   - Mode multi-select (5 canonical modes)
 *
 * URL state:
 *   - ?year=<start>-<end>&mode=<m1>,<m2>,... round-trips via useSearchParams.
 *   - Reset-all clears filters and URL.
 */
import { useMemo, useCallback, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Map as MapIcon, Layers, TrendingUp, TrendingDown, BarChart3, ChevronDown } from 'lucide-react'
import { useCrossingsStore } from '@/stores/crossingsStore'
import {
  MODES,
  REGIONS,
  MODE_LABELS,
  VALUE_KEY,
  filterRows,
  yearlyModeSeries,
  totalCrossings,
  parseYearRangeParam,
} from '@/lib/cbpHelpers'
import { formatNumber, formatCompact, CHART_COLORS } from '@/lib/chartColors'
import { PAGE_YEARLY_COLS, DL } from '@/lib/downloadColumns'
import { buildMapCrossings, aggregateByDataCrossing } from '@/hooks/useCrossingsMapData'

import DashboardLayout from '@/components/layout/DashboardLayout'
import SectionBlock from '@/components/ui/SectionBlock'
import ChartCard from '@/components/ui/ChartCard'
import StackedBarChart from '@/components/charts/StackedBarChart'
import DataTable from '@/components/ui/DataTable'
import CrossingsMap from '@/components/maps/CrossingsMap'
import FilterRadioGroup from '@/components/filters/FilterRadioGroup'
import YearRangeFilter from '@/components/filters/YearRangeFilter'
import { MODE_ICON_MAP } from '@/components/ui/ModeIcon'

/* Region palette — mirrors CrossingsMap so region color is consistent across
   the page. Charts #2 and #3 are colored by region. */
const REGION_BAR_COLORS = {
  'El Paso':           '#d97706', // amber (matches screenshot accent for El Paso column)
  'Laredo':            '#16a34a', // green
  'Rio Grande Valley': '#0056a9', // brand blue
}

/* ── URL param (de)serialisation ────────────────────────────────────── */

// Mode is single-select with a required default — unit-incompatible modes
// (trucks vs. pedestrians vs. railcars) shouldn't be summed. Accept the first
// valid value from the URL (single token or legacy CSV); fall back to MODES[0].
function parseModeParam(raw) {
  if (!raw) return MODES[0]
  const vals = String(raw).split(',').map((s) => s.trim()).filter(Boolean)
  return vals.find((v) => MODES.includes(v)) || MODES[0]
}

/* ── Per-region panel ───────────────────────────────────────────────── */

// `rows` are already scoped to the region and the active filter selection.
function RegionPanel({ region, rows, startYear, endYear }) {
  const { data: seriesData, keys: seriesKeys } = useMemo(
    () => yearlyModeSeries(rows),
    [rows],
  )

  const total = useMemo(() => totalCrossings(rows), [rows])
  const activeCrossings = useMemo(() => {
    const s = new Set()
    for (const r of rows) if (r.Crossing) s.add(r.Crossing)
    return s.size
  }, [rows])

  const hasData = rows.length > 0

  return (
    <ChartCard
      title={region}
      subtitle={hasData
        ? `${startYear}–${endYear} · ${activeCrossings} active crossing${activeCrossings === 1 ? '' : 's'}`
        : 'No data for current filters'}
      emptyState={!hasData ? `No crossings in ${region} match the current filters.` : undefined}
      minHeight={360}
    >
      <div className="flex flex-col h-full gap-3">
        {/* Region totals banner */}
        <div className="flex items-baseline justify-between px-1">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-text-secondary font-medium">
              Total northbound crossings
            </div>
            <div className="text-2xl font-bold text-text-primary leading-tight">
              {formatNumber(total)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-text-secondary font-medium">
              Active crossings
            </div>
            <div className="text-2xl font-bold text-text-primary leading-tight">
              {formatNumber(activeCrossings)}
            </div>
          </div>
        </div>

        {/* Yearly stack */}
        <div className="flex-1 min-h-0">
          {seriesData.length > 0 && seriesKeys.length > 0 ? (
            <StackedBarChart
              data={seriesData}
              xKey="year"
              stackKeys={seriesKeys}
              formatValue={formatCompact}
            />
          ) : (
            <div className="flex items-center justify-center h-48 text-text-secondary italic text-base">
              No yearly data for the selected filters.
            </div>
          )}
        </div>
      </div>
    </ChartCard>
  )
}

/* ── Region × Mode aggregator ───────────────────────────────────────── */

// Group a slice of yearly rows into a Region → Mode → total map.
// Returns a plain object keyed by region so React-memo keys stay stable.
function aggregateRegionMode(rows) {
  const out = {}
  for (const region of REGIONS) {
    out[region] = {}
    for (const mode of MODES) out[region][mode] = 0
  }
  for (const r of rows) {
    if (!REGIONS.includes(r.Region) || !MODES.includes(r.Modes)) continue
    out[r.Region][r.Modes] += r[VALUE_KEY] || 0
  }
  return out
}

/* ── Chart 1 · Percentage change (Region × Mode) ────────────────────── */
// Year endpoints are taken from the sidebar YearRangeFilter — no local picker.

function RegionPctChangeSection({ yearly, startYear, endYear }) {
  const rows = useMemo(() => {
    if (!yearly?.length || startYear == null || endYear == null) return []
    const startAgg = aggregateRegionMode(yearly.filter((r) => r.Year === startYear))
    const endAgg   = aggregateRegionMode(yearly.filter((r) => r.Year === endYear))
    return REGIONS.map((region) => {
      const row = { Region: region }
      for (const mode of MODES) {
        const s = startAgg[region][mode]
        const e = endAgg[region][mode]
        row[mode] = !s || !e ? null : ((e - s) / s) * 100
      }
      return row
    })
  }, [yearly, startYear, endYear])

  const columns = useMemo(() => {
    const renderPct = (v) => {
      if (v == null) return <span className="text-text-secondary/40">—</span>
      const rounded = Math.round(v * 10) / 10
      const sign = rounded > 0 ? '+' : ''
      const colorClass = rounded > 0
        ? 'text-green-700'
        : rounded < 0
          ? 'text-red-700'
          : 'text-text-secondary'
      return (
        <span className={`inline-flex items-center gap-1 font-medium ${colorClass}`}>
          {sign}{rounded.toFixed(1)}%
          {rounded > 0 && <TrendingUp size={14} />}
          {rounded < 0 && <TrendingDown size={14} />}
        </span>
      )
    }
    return [
      { key: 'Region', label: 'Region' },
      ...MODES.map((m) => ({ key: m, label: MODE_LABELS[m] || m, render: renderPct })),
    ]
  }, [])

  const sameYear = startYear != null && startYear === endYear

  return (
    <ChartCard
      title={`Percentage Change in NB Crossings (${startYear ?? '—'} to ${endYear ?? '—'})`}
      subtitle="Change in total northbound volume per region, per mode"
      emptyState={
        sameYear
          ? 'Start and end year are the same — widen the sidebar year range to compute change.'
          : rows.length === 0 ? 'No data available.' : undefined
      }
      minHeight={180}
    >
      <DataTable columns={columns} data={rows} pageSize={10} fullWidth />
    </ChartCard>
  )
}

/* ── Chart 2 · Region × Year grouped bars ───────────────────────────── */
// Region label rendered once; two bar rows (start year + end year) with the
// end-year row annotated by % change. Mode is taken from the sidebar.

function RegionChangeBarsSection({ yearly, startYear, endYear, mode }) {
  const data = useMemo(() => {
    if (!yearly?.length || startYear == null || endYear == null) return []
    const startAgg = aggregateRegionMode(yearly.filter((r) => r.Year === startYear))
    const endAgg   = aggregateRegionMode(yearly.filter((r) => r.Year === endYear))
    return REGIONS.map((region) => {
      const s = startAgg[region][mode] || 0
      const e = endAgg[region][mode]   || 0
      const pct = s > 0 ? ((e - s) / s) * 100 : null
      return { region, startValue: s, endValue: e, pct }
    })
  }, [yearly, startYear, endYear, mode])

  const maxVal = useMemo(
    () => Math.max(1, ...data.flatMap((d) => [d.startValue, d.endValue])),
    [data],
  )

  const empty = data.every((d) => d.startValue === 0 && d.endValue === 0)
  const sameYear = startYear != null && startYear === endYear

  // Bar sits on the left with the numeric label immediately to its right.
  // Reserve ~140px for the value + signed % badge (e.g. "3.4M  ↗+46.1%") so
  // the label + trend chip never clip against the card's right edge.
  const barStyle = (pct, color) => ({
    width: `calc((100% - 140px) * ${pct})`,
    minWidth: pct > 0 ? 4 : 0,
    height: '1.5rem',
    background: color,
  })

  return (
    <ChartCard
      title={`Change in NB Crossings (${startYear ?? '—'} to ${endYear ?? '—'}, Mode: ${MODE_LABELS[mode] || mode})`}
      subtitle="Start-year vs end-year totals per region"
      emptyState={
        sameYear
          ? 'Start and end year are the same — widen the sidebar year range to compare.'
          : empty ? 'No volume for this mode in either endpoint year.' : undefined
      }
      downloadData={{
        summary: {
          data: data.flatMap((d) => [
            { label: `${d.region} ${startYear}`, value: d.startValue },
            { label: `${d.region} ${endYear}`,   value: d.endValue },
          ]),
          filename: `region-change-${mode.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${startYear}-${endYear}`,
          columns: DL.regionRank,
        },
      }}
      minHeight={260}
    >
      <div className="space-y-8 pt-2 pb-4">
        {data.map(({ region, startValue, endValue, pct }) => {
          const color = REGION_BAR_COLORS[region] || CHART_COLORS[0]
          const sPct = startValue / maxVal
          const ePct = endValue   / maxVal
          const pctColor = pct == null
            ? 'text-text-secondary/60'
            : pct >= 0 ? 'text-green-700' : 'text-red-700'
          return (
            <div key={region} className="flex items-center gap-2">
              <div className="w-20 sm:w-24 flex-shrink-0 font-semibold text-text-primary text-sm">
                {region}
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-10 text-sm text-text-secondary tabular-nums flex-shrink-0">{startYear}</span>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <div className="rounded-sm flex-shrink-0" style={barStyle(sPct, color)} aria-hidden="true" />
                    <span className="font-semibold text-text-primary tabular-nums whitespace-nowrap">
                      {formatCompact(startValue)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-10 text-sm text-text-secondary tabular-nums flex-shrink-0">{endYear}</span>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <div className="rounded-sm flex-shrink-0" style={barStyle(ePct, color)} aria-hidden="true" />
                    <span className="font-semibold text-text-primary tabular-nums whitespace-nowrap">
                      {formatCompact(endValue)}
                    </span>
                    {pct != null && (
                      <span className={`text-xs font-medium inline-flex items-center gap-0.5 whitespace-nowrap ${pctColor}`}>
                        {pct >= 0
                          ? <TrendingUp size={12} />
                          : <TrendingDown size={12} />}
                        {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </ChartCard>
  )
}

/* ── Chart 3 · Region × Mode grid for a single year ─────────────────── */
// Local year selector. Bars sit left-aligned in each cell with the value
// label immediately to their right; faint column separators frame each mode.

function RegionModeGridSection({ yearly, yearsAvailable, year, onYearChange }) {
  const { cells, columnMax } = useMemo(() => {
    if (!yearly?.length || year == null) return { cells: {}, columnMax: {} }
    const agg = aggregateRegionMode(yearly.filter((r) => r.Year === year))
    const columnMax = {}
    for (const m of MODES) {
      let mx = 0
      for (const region of REGIONS) mx = Math.max(mx, agg[region][m] || 0)
      columnMax[m] = mx
    }
    return { cells: agg, columnMax }
  }, [yearly, year])

  const downloadRows = useMemo(() => {
    const out = []
    for (const region of REGIONS) {
      for (const m of MODES) {
        out.push({ Region: region, Mode: MODE_LABELS[m] || m, Value: cells[region]?.[m] ?? 0 })
      }
    }
    return out
  }, [cells])

  const compactYearPicker = (
    <label className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
      <span className="uppercase tracking-wider font-medium">Year</span>
      <span className="relative inline-block">
        <select
          value={year == null ? '' : String(year)}
          onChange={(e) => onYearChange(e.target.value ? Number(e.target.value) : null)}
          className="appearance-none px-2 py-1 pr-7 rounded-md border border-border bg-white
                     text-sm text-text-primary cursor-pointer
                     focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
        >
          {(yearsAvailable || []).map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
        <ChevronDown
          size={12}
          className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-text-secondary"
        />
      </span>
    </label>
  )

  return (
    <ChartCard
      title={`NB Crossings Per Region Per Mode (${year ?? '—'})`}
      subtitle="Bars scaled to the largest region within each mode column"
      headerRight={compactYearPicker}
      downloadData={{
        summary: {
          data: downloadRows,
          filename: `region-mode-grid-${year ?? 'na'}`,
          columns: { Region: 'Region', Mode: 'Mode', Value: 'Northbound Crossings' },
        },
      }}
      minHeight={220}
    >
      <div className="overflow-x-auto">
        <div
          className="grid gap-y-1 min-w-[820px] text-base"
          style={{ gridTemplateColumns: `minmax(170px, 1fr) repeat(${MODES.length}, minmax(150px, 2fr))` }}
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary pb-2 pr-3 border-b border-border-light">
            Region
          </div>
          {MODES.map((m, i) => (
            <div
              key={m}
              className={`text-xs font-semibold uppercase tracking-wider text-text-secondary pb-2 px-3 border-b border-border-light text-center ${i > 0 ? 'border-l border-border-light/50' : ''}`}
            >
              {MODE_LABELS[m] || m}
            </div>
          ))}
          {REGIONS.map((region) => {
            const color = REGION_BAR_COLORS[region]
            return (
              <div key={region} className="contents">
                <div className="py-2.5 pr-3 font-medium text-text-primary self-center whitespace-nowrap">{region}</div>
                {MODES.map((m, i) => {
                  const v = cells[region]?.[m] ?? 0
                  const mx = columnMax[m] || 1
                  const pct = mx > 0 ? v / mx : 0
                  return (
                    <div
                      key={m}
                      className={`py-2.5 px-3 flex items-center gap-2 min-w-0 overflow-hidden ${i > 0 ? 'border-l border-border-light/50' : ''}`}
                    >
                      <div
                        className="h-5 rounded-sm flex-shrink-0"
                        style={{
                          width: `calc((100% - 64px) * ${pct})`,
                          minWidth: v > 0 ? 3 : 0,
                          background: color,
                        }}
                        aria-hidden="true"
                      />
                      <span className="font-semibold text-text-primary whitespace-nowrap tabular-nums">
                        {formatCompact(v)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </ChartCard>
  )
}

/* ── Main page ──────────────────────────────────────────────────────── */

export default function ByRegionPage() {
  const status = useCrossingsStore((s) => s.status)

  /* ── Loading guard ──────────────────────────────────────────────────
     Render nothing beyond the spinner until the store is ready —
     otherwise the year-range filter mounts with null min/max and the
     URL-param parser quietly produces NaN years. */
  if (status !== 'ready') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-base text-text-secondary">Loading CBP crossings data…</p>
        </div>
      </div>
    )
  }

  return <ByRegionPageBody />
}

/* Body renders only once the store is ready — safe to call hooks that
   depend on minYear / maxYear / yearsAvailable being populated. */
function ByRegionPageBody() {
  const yearly = useCrossingsStore((s) => s.yearly)
  const coords = useCrossingsStore((s) => s.coords)
  const yearsAvailable = useCrossingsStore((s) => s.yearsAvailable)
  const minYear = useCrossingsStore((s) => s.minYear)
  const maxYear = useCrossingsStore((s) => s.maxYear)

  const [searchParams, setSearchParams] = useSearchParams()

  // Parse URL → filter state (falls back to min/max year / all modes).
  const { startYear, endYear } = useMemo(() => {
    const parsed = parseYearRangeParam(searchParams.get('year'), { minYear, maxYear })
    return {
      startYear: parsed?.start ?? minYear,
      endYear:   parsed?.end   ?? maxYear,
    }
  }, [searchParams, minYear, maxYear])
  const selectedMode = useMemo(
    () => parseModeParam(searchParams.get('mode')),
    [searchParams],
  )

  // Write helpers — always produce clean URLs.
  const updateParams = useCallback((updater) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      updater(next)
      // Drop defaults to keep URL tidy.
      const y = next.get('year')
      if (y === `${minYear}-${maxYear}`) next.delete('year')
      const m = next.get('mode')
      if (!m) next.delete('mode')
      return next
    }, { replace: true })
  }, [setSearchParams, minYear, maxYear])

  const setYearRange = useCallback(({ startYear: s, endYear: e }) => {
    updateParams((p) => {
      if (s === minYear && e === maxYear) p.delete('year')
      else p.set('year', `${s}-${e}`)
    })
  }, [updateParams, minYear, maxYear])

  const setMode = useCallback((mode) => {
    updateParams((p) => {
      if (!mode) p.delete('mode')
      else p.set('mode', mode)
    })
  }, [updateParams])

  const resetAll = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setSearchParams])

  /* ── Comparison section local state ────────────────────────────────
     Charts #1 and #2 read start/end year and mode from the sidebar. Only the
     single-year snapshot grid keeps its own year selector. */
  const [gridYear, setGridYear] = useState(null)

  useEffect(() => {
    if (maxYear != null && gridYear == null) setGridYear(maxYear)
  }, [maxYear, gridYear])

  /* ── Filtered rows (shared across panels + map + download) ──────── */

  const filteredYearly = useMemo(() => (
    filterRows(yearly, {
      yearRange: { start: startYear, end: endYear },
      modes: [selectedMode],
    })
  ), [yearly, startYear, endYear, selectedMode])

  // Map pins sized by total NB volume for the filtered window.
  // highlightNames = null → every pin is shown in full color; region palette
  // is applied by CrossingsMap automatically.
  const mapMarkers = useMemo(() => {
    if (!coords?.length || !yearly?.length) return []
    const totals = aggregateByDataCrossing(filteredYearly)
    return buildMapCrossings(coords, totals)
  }, [coords, yearly, filteredYearly])

  // Per-region row buckets, pre-filtered by year/mode so ModeShareBar
  // respects the active mode selection instead of silently summing all modes.
  const filteredRowsByRegion = useMemo(() => {
    const map = new Map(REGIONS.map((r) => [r, []]))
    for (const r of filteredYearly || []) {
      if (r.Region && map.has(r.Region)) map.get(r.Region).push(r)
    }
    return map
  }, [filteredYearly])

  /* ── Active filter tags + count (for sidebar) ──────────────────── */

  const activeCount = useMemo(() => {
    let n = 0
    if (!(startYear === minYear && endYear === maxYear)) n += 1
    // Mode always has exactly one value — not counted as an "active" filter
    // (it can't be unset, only changed).
    return n
  }, [startYear, endYear, minYear, maxYear])

  const activeTags = useMemo(() => {
    const tags = []
    if (!(startYear === minYear && endYear === maxYear)) {
      tags.push({
        group: 'Years',
        label: `${startYear}–${endYear}`,
        onRemove: () => setYearRange({ startYear: minYear, endYear: maxYear }),
      })
    }
    // Mode is single-select with a required default — no removable tag.
    return tags
  }, [startYear, endYear, minYear, maxYear, setYearRange])

  /* ── Empty-state detection ──────────────────────────────────────── */

  const filteredEmpty = useMemo(() => {
    if (!filteredYearly.length) return true
    return REGIONS.every((region) => (
      !filteredYearly.some((r) => r.Region === region)
    ))
  }, [filteredYearly])

  /* ── Sidebar filters ────────────────────────────────────────────── */

  const filters = (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 min-w-0 w-full">
        <label className="text-base font-medium text-text-secondary uppercase tracking-wider">
          Year Range
        </label>
        <YearRangeFilter
          years={yearsAvailable}
          startYear={startYear}
          endYear={endYear}
          onChange={setYearRange}
        />
      </div>
      <FilterRadioGroup
        label="Mode"
        name="by-region-mode"
        value={selectedMode}
        options={MODES.map((m) => ({ value: m, label: MODE_LABELS[m] || m }))}
        onChange={setMode}
        iconMap={MODE_ICON_MAP}
      />
    </div>
  )

  /* ── Page download (filtered yearly rows) ───────────────────────── */

  const pageDownload = {
    data: filteredYearly,
    filename: `cbp-by-region_${startYear}-${endYear}_${selectedMode.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    columns: PAGE_YEARLY_COLS,
  }

  /* ── Hero ───────────────────────────────────────────────────────── */

  const hero = (
    <div className="gradient-blue text-white relative overflow-visible">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-7 pb-5 md:pt-9 md:pb-6">
        <div className="flex items-center gap-2 text-white/80 text-base font-medium mb-2">
          <Layers size={16} />
          <span className="uppercase tracking-wider">By Region</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white text-balance">
          Compare the three CBP field-office regions
        </h2>
        <p className="text-white/80 mt-2 text-sm md:text-base leading-relaxed max-w-3xl">
          El Paso, Laredo, and Rio Grande Valley each oversee a distinct stretch
          of the Texas–Mexico border. Filter by year range or mode to compare
          how each region's northbound crossings have evolved.
        </p>
      </div>
    </div>
  )

  return (
    <DashboardLayout
      hero={hero}
      filters={filters}
      onResetAll={resetAll}
      activeCount={activeCount}
      activeTags={activeTags}
      pageDownload={pageDownload}
      filteredEmpty={filteredEmpty}
    >
      {/* ── Region panels ───────────────────────────────────────── */}
      <SectionBlock>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5 mb-5">
            <Layers size={20} className="text-brand-blue" />
            <h3 className="text-xl font-bold text-text-primary">
              Yearly crossings by region ({startYear}–{endYear})
            </h3>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {REGIONS.map((region) => (
              <RegionPanel
                key={region}
                region={region}
                rows={filteredRowsByRegion.get(region) || []}
                startYear={startYear}
                endYear={endYear}
              />
            ))}
          </div>
        </div>
      </SectionBlock>

      {/* ── Region × Mode comparison charts ─────────────────────── */}
      <SectionBlock alt>
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-2.5">
            <BarChart3 size={20} className="text-brand-blue" />
            <h3 className="text-xl font-bold text-text-primary">
              Region vs Region — Change &amp; Snapshot
            </h3>
          </div>
          <p className="text-base text-text-secondary leading-relaxed max-w-3xl">
            Pick two endpoint years to see how each region&rsquo;s northbound
            crossings shifted by mode, then drop into a single-year snapshot to
            compare regions side-by-side. These charts are independent of the
            sidebar filters.
          </p>

          <div className="grid grid-cols-1 gap-6">
            <RegionPctChangeSection
              yearly={yearly}
              startYear={startYear}
              endYear={endYear}
            />
            <RegionChangeBarsSection
              yearly={yearly}
              startYear={startYear}
              endYear={endYear}
              mode={selectedMode}
            />
            <RegionModeGridSection
              yearly={yearly}
              yearsAvailable={yearsAvailable}
              year={gridYear}
              onYearChange={setGridYear}
            />
          </div>
        </div>
      </SectionBlock>

      {/* ── Map ─────────────────────────────────────────────────── */}
      <SectionBlock>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5 mb-4">
            <MapIcon size={20} className="text-brand-blue" />
            <h3 className="text-xl font-bold text-text-primary">
              All 34 crossings, colored by region
            </h3>
          </div>
          <p className="text-base text-text-secondary leading-relaxed mb-4 max-w-3xl">
            Circle size reflects total northbound {MODE_LABELS[selectedMode] || selectedMode}
            {' '}crossings in the year window ({startYear}–{endYear}). Click any pin
            to drill into its full history.
          </p>
          <div className="rounded-xl overflow-hidden shadow-sm ring-1 ring-border-light bg-white" style={{ height: 560 }}>
            {mapMarkers.length > 0 ? (
              <CrossingsMap
                crossings={mapMarkers}
                height="560px"
                metricLabel="crossings"
                highlightNames={null}
              />
            ) : (
              <div className="w-full h-full bg-surface-alt flex items-center justify-center">
                <p className="text-text-secondary text-base">No map data for the current filters.</p>
              </div>
            )}
          </div>
        </div>
      </SectionBlock>
    </DashboardLayout>
  )
}
