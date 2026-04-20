/**
 * ByCrossing — Crossing-centric drill-down page.
 *
 * Route: /by-crossing
 *
 * Four sidebar filters (Year range, Mode, Region, Crossing) feed:
 *   1. A locator map (highlights selected crossings)
 *   2. A yearly line chart (one series per mode)
 *   3. A paginated detail table (Year × Crossing × Mode)
 *
 * All filter state round-trips through URL query params so the page is
 * deep-linkable and survives refresh.
 */
import { useMemo, useCallback, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapPin, TrendingUp, TrendingDown, Table as TableIcon, Percent, Grid2x2, PieChart as PieChartIcon } from 'lucide-react'

import { useCrossingsStore } from '@/stores/crossingsStore'
import {
  MODES,
  MODE_LABELS,
  REGIONS,
  filterRows,
  crossingSeries,
  makeCrossingOrderComparator,
  parseYearRangeParam,
  VALUE_KEY,
} from '@/lib/cbpHelpers'
import { formatNumber, formatCompact } from '@/lib/chartColors'
import { buildMapCrossings, aggregateByDataCrossing } from '@/hooks/useCrossingsMapData'
import { PAGE_YEARLY_COLS, DL } from '@/lib/downloadColumns'

import DashboardLayout from '@/components/layout/DashboardLayout'
import SectionBlock from '@/components/ui/SectionBlock'
import ChartCard from '@/components/ui/ChartCard'
import DataTable from '@/components/ui/DataTable'
import LineChart from '@/components/charts/LineChart'
import TreemapChart from '@/components/charts/TreemapChart'
import DonutChart from '@/components/charts/DonutChart'
import CrossingsMap from '@/components/maps/CrossingsMap'
import FilterMultiSelect from '@/components/filters/FilterMultiSelect'
import YearRangeFilter from '@/components/filters/YearRangeFilter'
import ModeIcon from '@/components/ui/ModeIcon'

/* Region palette — mirrors the Overview/ByRegion chart palette so the
 * Region filter card and the charts share a consistent color identity. */
const REGION_COLORS = {
  'El Paso':           '#d97706',
  'Laredo':            '#16a34a',
  'Rio Grande Valley': '#0056a9',
}

/* ─── URL-param helpers ───────────────────────────────────────────────── */

function parseMulti(raw) {
  if (!raw) return []
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

function joinMulti(arr) {
  return arr && arr.length ? arr.join(',') : null
}

function formatYearRange(start, end) {
  if (start == null || end == null) return null
  return start === end ? String(start) : `${start}-${end}`
}

export default function ByCrossingPage() {
  const status         = useCrossingsStore((s) => s.status)
  const yearly         = useCrossingsStore((s) => s.yearly)
  const coords         = useCrossingsStore((s) => s.coords)
  const yearsAvailable = useCrossingsStore((s) => s.yearsAvailable)
  const minYear        = useCrossingsStore((s) => s.minYear)
  const maxYear        = useCrossingsStore((s) => s.maxYear)

  const [searchParams, setSearchParams] = useSearchParams()

  /* ─── Decode filters from URL ───────────────────────────────────────── */
  // Mode is intentionally not a filter on this page — the line chart and
  // percentage-change table already break out each mode as its own series/
  // column, so mode-level selection happens in-situ rather than in the
  // sidebar.
  const filters = useMemo(() => {
    const yr = parseYearRangeParam(searchParams.get('year'), { minYear, maxYear })
    const regionsRaw = parseMulti(searchParams.get('region'))
    return {
      startYear: yr?.start ?? minYear,
      endYear:   yr?.end   ?? maxYear,
      // Region is single-select with a default — if the URL has no (or an
      // invalid) region, fall back to El Paso.
      regions:   regionsRaw.length && REGIONS.includes(regionsRaw[0])
        ? [regionsRaw[0]]
        : ['El Paso'],
      crossings: parseMulti(searchParams.get('crossing')),
    }
  }, [searchParams, minYear, maxYear])

  /* ─── Filter updaters (all route through setSearchParams) ───────────── */
  const updateParam = useCallback((key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value == null || value === '' || (Array.isArray(value) && !value.length)) {
        next.delete(key)
      } else {
        next.set(key, Array.isArray(value) ? value.join(',') : String(value))
      }
      return next
    }, { replace: true })
  }, [setSearchParams])

  const setYearRange = useCallback(({ startYear, endYear }) => {
    updateParam('year', formatYearRange(startYear, endYear))
  }, [updateParam])

  // Region is single-select — write the bare string to the URL.
  const setRegion    = useCallback((v) => updateParam('region', v || null), [updateParam])
  const setCrossings = useCallback((v) => updateParam('crossing', joinMulti(v)), [updateParam])

  const resetAll = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setSearchParams])

  /* ─── Derived data (guarded until store ready) ──────────────────────── */

  // Distinct crossings sorted north-to-south for the filter options
  const crossingOptions = useMemo(() => {
    if (!yearly?.length) return []
    const s = new Set()
    for (const r of yearly) if (r.Crossing) s.add(r.Crossing)
    const cmp = makeCrossingOrderComparator(coords)
    return [...s].sort(cmp)
  }, [yearly, coords])

  // Full filter-result (yearly rows) — drives table + chart + map
  const filteredYearly = useMemo(() => {
    if (!yearly?.length) return []
    return filterRows(yearly, {
      yearRange: { start: filters.startYear, end: filters.endYear },
      regions:   filters.regions,
      crossings: filters.crossings,
    })
  }, [yearly, filters])

  /* ─── "Per crossing" breakdown: local mode, year, and chart-type state ── */
  // Single-year, single-mode breakdown across the crossings in the active
  // region. Independent of the sidebar year range (which is a span, not a
  // point) and the sidebar crossing filter (this section always shows every
  // crossing in the region so the treemap/donut stays comparable).
  const [perCrossingMode, setPerCrossingMode] = useState('Pedestrians/ Bicyclists')
  const [perCrossingYear, setPerCrossingYear] = useState(null)
  const [perCrossingChart, setPerCrossingChart] = useState('treemap')

  useEffect(() => {
    if (maxYear != null && perCrossingYear == null) setPerCrossingYear(maxYear)
  }, [maxYear, perCrossingYear])

  const perCrossingRows = useMemo(() => {
    if (!yearly?.length || perCrossingYear == null) return []
    const region = filters.regions[0]
    const bucket = new Map()
    for (const r of yearly) {
      if (r.Year !== perCrossingYear) continue
      if (region && r.Region !== region) continue
      if (r.Modes !== perCrossingMode) continue
      if (!r.Crossing) continue
      bucket.set(r.Crossing, (bucket.get(r.Crossing) || 0) + (r[VALUE_KEY] || 0))
    }
    const cmp = makeCrossingOrderComparator(coords)
    return [...bucket.entries()]
      .map(([label, value]) => ({ label, value }))
      .filter((d) => d.value > 0)
      .sort((a, b) => cmp(a.label, b.label))
  }, [yearly, coords, filters.regions, perCrossingMode, perCrossingYear])

  /* ─── Percentage-change section: local two-year selectors ────────────── */
  // Independent of the sidebar year-range slider — this view needs exactly two
  // specific years, not a range. Defaults to the full available span.
  const [pctStart, setPctStart] = useState(null)
  const [pctEnd, setPctEnd]     = useState(null)

  useEffect(() => {
    if (minYear != null && pctStart == null) setPctStart(minYear)
    if (maxYear != null && pctEnd == null)   setPctEnd(maxYear)
  }, [minYear, maxYear, pctStart, pctEnd])

  const pctStartYear = pctStart ?? minYear
  const pctEndYear   = pctEnd   ?? maxYear

  const handlePctYearChange = useCallback(({ startYear, endYear }) => {
    setPctStart(startYear)
    setPctEnd(endYear)
  }, [])

  const pctRows = useMemo(() => {
    if (!yearly?.length || pctStartYear == null || pctEndYear == null) return []

    // Respect sidebar region + crossing filters (but not the year range, since
    // this section supplies its own two-year endpoints).
    const base = filterRows(yearly, {
      regions:   filters.regions,
      crossings: filters.crossings,
    })

    const crossingSet = new Set()
    for (const r of base) if (r.Crossing) crossingSet.add(r.Crossing)
    const cmp = makeCrossingOrderComparator(coords)
    const crossings = [...crossingSet].sort(cmp)

    // Crossing|Mode → { start, end }
    const bucket = new Map()
    for (const r of base) {
      if (r.Year !== pctStartYear && r.Year !== pctEndYear) continue
      if (!r.Crossing || !r.Modes) continue
      const key = `${r.Crossing}|${r.Modes}`
      if (!bucket.has(key)) bucket.set(key, { start: 0, end: 0 })
      const b = bucket.get(key)
      if (r.Year === pctStartYear) b.start += r[VALUE_KEY] || 0
      if (r.Year === pctEndYear)   b.end   += r[VALUE_KEY] || 0
    }

    return crossings.map((crossing) => {
      const row = { Crossing: crossing }
      for (const mode of MODES) {
        const b = bucket.get(`${crossing}|${mode}`)
        // Blank when either endpoint has zero volume — either the crossing
        // didn't operate that mode in that year, or data is genuinely missing.
        // Either way, a % change is undefined.
        row[mode] = !b || b.start === 0 || b.end === 0 ? null : ((b.end - b.start) / b.start) * 100
      }
      return row
    })
  }, [yearly, coords, pctStartYear, pctEndYear, filters.regions, filters.crossings])

  const pctColumns = useMemo(() => {
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
      { key: 'Crossing', label: 'Crossing' },
      ...MODES.map((m) => ({
        key: m,
        label: MODE_LABELS[m] || m,
        render: renderPct,
      })),
    ]
  }, [])

  /* ─── Map markers ───────────────────────────────────────────────────── */
  const mapMarkers = useMemo(() => {
    if (!coords?.length || !yearly?.length) return []
    // Map sizing reflects the currently filtered data — so the user sees
    // the volume they care about. If no crossings are highlighted, all pins
    // remain visible at their filtered totals.
    const totals = aggregateByDataCrossing(filteredYearly)
    return buildMapCrossings(coords, totals)
  }, [coords, yearly, filteredYearly])

  // Highlight selected crossings by their data_crossing_name equivalents
  const highlightNames = useMemo(() => {
    if (!filters.crossings.length || !coords?.length) return null
    // The Crossing value in data rows already matches data_crossing_name, so
    // pass them through directly.
    return filters.crossings
  }, [filters.crossings, coords])

  /* ─── Line-chart series (year × mode, long format) ──────────────────── */
  const lineChartData = useMemo(() => {
    if (!filteredYearly.length) return { data: [], keys: [] }

    // When exactly one crossing is selected we can use the helper directly.
    if (filters.crossings.length === 1) {
      const { data: wide, keys } = crossingSeries(filteredYearly, { granularity: 'year' })
      const long = []
      for (const row of wide) {
        for (const k of keys) {
          long.push({ year: row.Year, Mode: k, value: row[k] || 0 })
        }
      }
      return { data: long, keys }
    }

    // Otherwise aggregate ourselves: sum VALUE_KEY by Year × Mode.
    const keysSet = new Set()
    const bucket = new Map() // `${year}|${mode}` -> sum
    for (const r of filteredYearly) {
      if (r.Year == null || !r.Modes) continue
      keysSet.add(r.Modes)
      const key = `${r.Year}|${r.Modes}`
      bucket.set(key, (bucket.get(key) || 0) + (r[VALUE_KEY] || 0))
    }
    const keys = MODES.filter((m) => keysSet.has(m))
    const years = [...new Set(filteredYearly.map((r) => r.Year).filter(Number.isFinite))]
      .sort((a, b) => a - b)

    const data = []
    for (const y of years) {
      for (const k of keys) {
        data.push({ year: y, Mode: k, value: bucket.get(`${y}|${k}`) || 0 })
      }
    }
    return { data, keys }
  }, [filteredYearly, filters.crossings.length])

  /* ─── Detail table rows ─────────────────────────────────────────────── */
  const tableColumns = useMemo(() => ([
    { key: 'Year',     label: 'Year' },
    { key: 'Region',   label: 'Region' },
    { key: 'POE',      label: 'Port of Entry' },
    { key: 'Crossing', label: 'Crossing' },
    { key: 'Modes',    label: 'Mode' },
    {
      key: VALUE_KEY,
      label: 'Northbound Crossings',
      render: (v) => formatNumber(v),
    },
  ]), [])

  /* ─── Active filter tags + count ────────────────────────────────────── */
  const activeTags = useMemo(() => {
    const tags = []

    // Year range is "active" only when not the full available range
    if (
      minYear != null && maxYear != null &&
      (filters.startYear !== minYear || filters.endYear !== maxYear)
    ) {
      tags.push({
        group: 'Year',
        label: formatYearRange(filters.startYear, filters.endYear),
        onRemove: () => updateParam('year', null),
      })
    }

    // Mode and Region are single-select with required defaults — no removable
    // tags (they can't be "cleared", only swapped).
    filters.crossings.forEach((c) => tags.push({
      group: 'Crossing',
      label: c,
      onRemove: () => setCrossings(filters.crossings.filter((x) => x !== c)),
    }))

    return tags
  }, [filters, minYear, maxYear, updateParam, setCrossings])

  const activeGroupCount = useMemo(() => {
    let n = 0
    if (
      minYear != null && maxYear != null &&
      (filters.startYear !== minYear || filters.endYear !== maxYear)
    ) n += 1
    // Mode and Region always have exactly one value — not counted as
    // "active" filters (they can't be unset, only changed).
    if (filters.crossings.length) n += 1
    return n
  }, [filters, minYear, maxYear])

  /* ─── Filter sidebar JSX ────────────────────────────────────────────── */
  const filterControls = (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 min-w-0 w-full">
        <span className="text-base font-medium text-text-secondary uppercase tracking-wider">
          Year Range
        </span>
        <YearRangeFilter
          years={yearsAvailable || []}
          startYear={filters.startYear ?? minYear}
          endYear={filters.endYear ?? maxYear}
          onChange={setYearRange}
        />
      </div>

      <div className="flex flex-col gap-1 min-w-0 w-full">
        <span className="text-base font-medium text-text-secondary uppercase tracking-wider">
          Region
        </span>
        <div role="radiogroup" aria-label="Region" className="flex flex-col gap-1.5 mt-1">
          {REGIONS.map((r) => {
            const selected = filters.regions[0] === r
            const color = REGION_COLORS[r]
            const rowStyle = selected
              ? { borderColor: color, backgroundColor: `${color}1A` }
              : undefined
            return (
              <label
                key={r}
                style={rowStyle}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${selected ? 'border' : 'border-border hover:bg-brand-blue/5'}`}
              >
                <input
                  type="radio"
                  name="by-crossing-region"
                  value={r}
                  checked={selected}
                  onChange={() => setRegion(r)}
                  className="sr-only"
                />
                <span
                  style={selected ? { borderColor: color } : undefined}
                  className={`flex-shrink-0 flex items-center justify-center w-4 h-4 rounded-full border-2 ${selected ? '' : 'border-border'}`}
                >
                  {selected && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
                </span>
                <span
                  aria-hidden="true"
                  className="flex-shrink-0 inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span
                  style={selected ? { color } : undefined}
                  className={`text-sm ${selected ? 'font-medium' : 'text-text-primary'}`}
                >
                  {r}
                </span>
              </label>
            )
          })}
        </div>
      </div>

      <FilterMultiSelect
        label="Crossing"
        value={filters.crossings}
        options={crossingOptions}
        onChange={setCrossings}
        allLabel="All crossings"
        searchable
      />
    </div>
  )

  /* ─── Page-level downloads ──────────────────────────────────────────── */
  const yearTag = formatYearRange(filters.startYear, filters.endYear) || 'all-years'
  const pageDownload = useMemo(() => ({
    data: filteredYearly,
    filename: `by-crossing-${yearTag}`,
    columns: PAGE_YEARLY_COLS,
  }), [filteredYearly, yearTag])

  /* ─── Loading state ─────────────────────────────────────────────────── */
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

  const filteredEmpty = activeGroupCount > 0 && filteredYearly.length === 0

  /* ─── Hero ──────────────────────────────────────────────────────────── */
  const hero = (
    <div className="gradient-blue text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-7 md:py-9">
        <h2 className="text-2xl md:text-3xl font-bold text-white text-balance">
          By Crossing
        </h2>
        <p className="text-white/80 mt-2 text-sm md:text-base leading-relaxed max-w-3xl">
          Drill into any of the 34 Texas–Mexico northbound crossings. Filter by
          year range, region, or specific crossing to isolate the trend and
          table rows you care about. All selections round-trip through the URL
          so the view is shareable and refresh-safe.
        </p>
      </div>
    </div>
  )

  const lineSubtitle = (() => {
    const parts = []
    parts.push(`${filters.startYear}–${filters.endYear}`)
    if (filters.crossings.length === 1) {
      parts.push(filters.crossings[0])
    } else if (filters.crossings.length > 1) {
      parts.push(`${filters.crossings.length} crossings`)
    } else {
      parts.push('all crossings')
    }
    return parts.join(' · ')
  })()

  return (
    <DashboardLayout
      hero={hero}
      filters={filterControls}
      onResetAll={resetAll}
      activeCount={activeGroupCount}
      activeTags={activeTags}
      pageDownload={pageDownload}
      filteredEmpty={filteredEmpty}
    >
      {/* ─── Locator map ───────────────────────────────────────────────── */}
      <SectionBlock>
        <div className="flex items-center gap-2.5 mb-4">
          <MapPin size={20} className="text-brand-blue" />
          <h3 className="text-xl font-bold text-text-primary">Locator Map</h3>
        </div>
        <p className="text-base text-text-secondary leading-relaxed mb-4 max-w-3xl">
          {highlightNames?.length
            ? 'Highlighted pins match the crossings selected in the Crossing filter. Unhighlighted pins remain visible for spatial context.'
            : 'All 34 crossings. Circle size reflects total northbound volume within the active filter selection; color marks the CBP field-office region.'}
        </p>
        <div className="rounded-xl overflow-hidden shadow-sm ring-1 ring-border-light" style={{ height: 400 }}>
          {mapMarkers.length > 0 ? (
            <CrossingsMap
              crossings={mapMarkers}
              height="400px"
              metricLabel="crossings (filtered)"
              highlightNames={highlightNames}
            />
          ) : (
            <div className="w-full h-full bg-surface-alt flex items-center justify-center">
              <p className="text-text-secondary text-sm">No map data for the current filters.</p>
            </div>
          )}
        </div>
      </SectionBlock>

      {/* ─── Time-series line chart ────────────────────────────────────── */}
      <SectionBlock alt>
        <div className="flex items-center gap-2.5 mb-4">
          <TrendingUp size={20} className="text-brand-blue" />
          <h3 className="text-xl font-bold text-text-primary">Yearly Trend by Mode</h3>
        </div>
        <ChartCard
          title="Northbound Crossings by Year"
          subtitle={lineSubtitle}
          emptyState={lineChartData.data.length === 0
            ? 'No data matches the current filter selection.'
            : undefined}
          downloadData={{
            summary: {
              data: lineChartData.data.map((d) => ({ year: d.year, value: d.value, series: d.Mode })),
              filename: `by-crossing-trend-${yearTag}`,
              columns: DL.crossingsTrendSeries,
            },
          }}
        >
          <LineChart
            data={lineChartData.data}
            xKey="year"
            yKey="value"
            seriesKey={lineChartData.keys.length > 1 ? 'Mode' : undefined}
            formatValue={formatCompact}
          />
        </ChartCard>
      </SectionBlock>

      {/* ─── Per-crossing single-year breakdown (Treemap ⇄ Donut) ──────── */}
      <SectionBlock>
        <div className="flex items-center gap-2.5 mb-4">
          <Grid2x2 size={20} className="text-brand-blue" />
          <h3 className="text-xl font-bold text-text-primary">NB Crossings Per Crossing</h3>
        </div>
        <p className="text-base text-text-secondary leading-relaxed mb-4 max-w-3xl">
          Share of a single mode across every crossing in the active region
          for one year. Toggle between a treemap (emphasizes rank by area) and
          a donut (emphasizes percentage share).
        </p>
        <ChartCard
          title="NB Crossings Per Crossing"
          subtitle={
            <span className="inline-flex items-center gap-1.5">
              <ModeIcon mode={perCrossingMode} size={16} className="text-accent" />
              Mode: <span className="text-accent font-semibold">{MODE_LABELS[perCrossingMode] || perCrossingMode}</span>
              {', '}
              Region: <span className="text-accent font-semibold">{filters.regions[0]}</span>
            </span>
          }
          emptyState={perCrossingRows.length === 0
            ? 'No data for this region / mode / year combination.'
            : undefined}
          headerRight={
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-1.5 text-sm text-text-secondary">
                <span>Mode</span>
                <select
                  value={perCrossingMode}
                  onChange={(e) => setPerCrossingMode(e.target.value)}
                  className="border border-border rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                >
                  {MODES.map((m) => (
                    <option key={m} value={m}>{MODE_LABELS[m] || m}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-sm text-text-secondary">
                <span>Year</span>
                <select
                  value={perCrossingYear ?? ''}
                  onChange={(e) => setPerCrossingYear(Number(e.target.value))}
                  className="border border-border rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                >
                  {(yearsAvailable || []).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>
              <div role="radiogroup" aria-label="Chart type" className="inline-flex rounded-md border border-border overflow-hidden">
                <button
                  type="button"
                  role="radio"
                  aria-checked={perCrossingChart === 'treemap'}
                  onClick={() => setPerCrossingChart('treemap')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-sm transition-colors ${
                    perCrossingChart === 'treemap'
                      ? 'bg-brand-blue text-white'
                      : 'bg-white text-text-secondary hover:bg-surface-alt'
                  }`}
                  title="Treemap view"
                >
                  <Grid2x2 size={14} />
                  <span>Treemap</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={perCrossingChart === 'donut'}
                  onClick={() => setPerCrossingChart('donut')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-sm border-l border-border transition-colors ${
                    perCrossingChart === 'donut'
                      ? 'bg-brand-blue text-white'
                      : 'bg-white text-text-secondary hover:bg-surface-alt'
                  }`}
                  title="Donut view"
                >
                  <PieChartIcon size={14} />
                  <span>Donut</span>
                </button>
              </div>
            </div>
          }
          downloadData={{
            summary: {
              data: perCrossingRows.map((d) => ({
                Year: perCrossingYear,
                Region: filters.regions[0],
                Mode: perCrossingMode,
                Crossing: d.label,
                [VALUE_KEY]: d.value,
              })),
              filename: `by-crossing-per-crossing-${filters.regions[0]?.replace(/\s+/g, '-').toLowerCase()}-${perCrossingMode.replace(/\W+/g, '-').toLowerCase()}-${perCrossingYear}`,
              columns: [
                { key: 'Year',     label: 'Year' },
                { key: 'Region',   label: 'Region' },
                { key: 'Mode',     label: 'Mode' },
                { key: 'Crossing', label: 'Crossing' },
                { key: VALUE_KEY,  label: 'Northbound Crossings' },
              ],
            },
          }}
        >
          {/* Fixed-height wrapper so toggling Treemap ⇄ Donut doesn't reflow the
              page. Treemap fills it; Donut centers inside. */}
          <div className="flex items-center justify-center" style={{ minHeight: 640 }}>
            {perCrossingChart === 'treemap' ? (
              <TreemapChart
                data={perCrossingRows}
                nameKey="label"
                valueKey="value"
                formatValue={formatCompact}
              />
            ) : (
              <DonutChart
                data={perCrossingRows}
                nameKey="label"
                valueKey="value"
                formatValue={formatCompact}
              />
            )}
          </div>
        </ChartCard>
      </SectionBlock>

      {/* ─── Percentage change matrix ──────────────────────────────────── */}
      <SectionBlock>
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 mb-2">
              <Percent size={20} className="text-brand-blue" />
              <h3 className="text-xl font-bold text-text-primary">
                Percentage Change by Crossing &amp; Mode
              </h3>
            </div>
            <p className="text-base text-text-secondary leading-relaxed max-w-3xl">
              Pick a start year and an end year to see how northbound volume
              shifted at each crossing. Empty cells mean no activity in one or
              both endpoint years, so a percentage change can&rsquo;t be computed.
              Region and Crossing sidebar filters still apply; the sidebar year
              range does not.
            </p>
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            <div className="flex gap-6 items-baseline">
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Start Year</span>
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">End Year</span>
            </div>
            <YearRangeFilter
              years={yearsAvailable || []}
              startYear={pctStartYear ?? minYear}
              endYear={pctEndYear ?? maxYear}
              onChange={handlePctYearChange}
            />
          </div>
        </div>

        {pctRows.length > 0 && pctColumns.length > 1 ? (
          <DataTable
            columns={pctColumns}
            data={pctRows}
            pageSize={50}
          />
        ) : (
          <div className="bg-white rounded-xl border border-border-light shadow-xs p-8 text-center">
            <p className="text-base text-text-secondary">
              No crossings match the current region / crossing / mode filters.
            </p>
          </div>
        )}
      </SectionBlock>

      {/* ─── Detail table ──────────────────────────────────────────────── */}
      <SectionBlock>
        <div className="flex items-center gap-2.5 mb-4">
          <TableIcon size={20} className="text-brand-blue" />
          <h3 className="text-xl font-bold text-text-primary">Detail Table</h3>
        </div>
        <p className="text-base text-text-secondary leading-relaxed mb-4 max-w-3xl">
          One row per Year × Crossing × Mode. Click column headers to sort; use
          the Download button in the filter panel to export the filtered rows.
        </p>
        {filteredYearly.length > 0 ? (
          <div className="bg-white rounded-xl border border-border-light shadow-xs overflow-hidden">
            <DataTable
              columns={tableColumns}
              data={filteredYearly}
              pageSize={25}
            />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border-light shadow-xs p-8 text-center">
            <p className="text-base text-text-secondary">
              No rows match the current filter selection.
            </p>
          </div>
        )}
      </SectionBlock>
    </DashboardLayout>
  )
}
