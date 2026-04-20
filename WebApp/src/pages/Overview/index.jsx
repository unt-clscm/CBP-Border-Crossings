import { useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Users, ArrowRight, TrendingUp, TrendingDown, Minus, Award, MapPin,
  PieChart as PieIcon, BarChart3, CalendarDays, ChevronDown,
} from 'lucide-react'
import { useCrossingsStore } from '@/stores/crossingsStore'
import { formatNumber, formatPercent, formatCompact } from '@/lib/chartColors'
import {
  filterRows, modeMix, topCrossings, MODES, MODE_LABELS, REGIONS, VALUE_KEY,
  yearlyRegionSeries, parseYearRangeParam,
  monthlySeasonalSeries, MONTH_LABELS,
  makeCrossingOrderComparator,
} from '@/lib/cbpHelpers'
import { buildMapCrossings, aggregateByDataCrossing } from '@/hooks/useCrossingsMapData'
import DashboardLayout from '@/components/layout/DashboardLayout'
import SectionBlock from '@/components/ui/SectionBlock'
import ChartCard from '@/components/ui/ChartCard'
import StatCard from '@/components/ui/StatCard'
import StackedBarChart from '@/components/charts/StackedBarChart'
import BarChart from '@/components/charts/BarChart'
import DonutChart from '@/components/charts/DonutChart'
import LineChart from '@/components/charts/LineChart'
import CrossingsMap from '@/components/maps/CrossingsMap'
import FilterCheckboxGroup from '@/components/filters/FilterCheckboxGroup'
import FilterRadioGroup from '@/components/filters/FilterRadioGroup'
import FilterMultiSelect from '@/components/filters/FilterMultiSelect'
import YearRangeFilter from '@/components/filters/YearRangeFilter'
import { MODE_ICON_MAP } from '@/components/ui/ModeIcon'
import { DL, PAGE_YEARLY_COLS } from '@/lib/downloadColumns'

const COMPARE_START_COLOR = '#93c5fd' // blue-300 — muted "past"
const COMPARE_END_COLOR   = '#0056a9' // TxDOT blue — "current"
const DELTA_UP_COLOR   = '#16a34a' // green-600
const DELTA_DOWN_COLOR = '#dc2626' // red-600

const REGION_COLORS = {
  'El Paso':           '#d97706',
  'Laredo':            '#16a34a',
  'Rio Grande Valley': '#0056a9',
}

// Mode palette — chosen to avoid overlap with the region palette (amber,
// green, blue) so side-by-side region + mode charts are unambiguous.
const MODE_COLORS = {
  'Commercial Trucks':       '#6d28d9', // deep violet
  'Buses':                   '#be123c', // crimson
  'Pedestrians/ Bicyclists': '#0d9488', // teal
  'Passenger Vehicles':      '#2563eb', // blue — distinct from RGV's darker navy region color
  'Railcars':                '#facc15', // amber-yellow
}

function compactNumber(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`
  return `${sign}${abs.toFixed(0)}`
}

function parseCsvParam(str) {
  if (!str) return []
  return str.split(',').map((s) => s.trim()).filter(Boolean)
}

function parseModeParam(raw) {
  if (!raw) return MODES[0]
  const vals = String(raw).split(',').map((s) => s.trim()).filter(Boolean)
  return vals.find((v) => MODES.includes(v)) || MODES[0]
}

export default function OverviewPage() {
  const status = useCrossingsStore((s) => s.status)

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
  return <OverviewPageBody />
}

function OverviewPageBody() {
  const yearly         = useCrossingsStore((s) => s.yearly)
  const monthly        = useCrossingsStore((s) => s.monthly)
  const monthlyStatus  = useCrossingsStore((s) => s.monthlyStatus)
  const coords         = useCrossingsStore((s) => s.coords)
  const yearsAvailable = useCrossingsStore((s) => s.yearsAvailable)
  const minYear        = useCrossingsStore((s) => s.minYear)
  const maxYear        = useCrossingsStore((s) => s.maxYear)

  const [searchParams, setSearchParams] = useSearchParams()

  const parsedYearRange = parseYearRangeParam(searchParams.get('year'), { minYear, maxYear })
  const startYear = parsedYearRange?.start ?? minYear
  const endYear   = parsedYearRange?.end   ?? maxYear
  const selectedRegions = useMemo(
    () => parseCsvParam(searchParams.get('region')).filter((r) => REGIONS.includes(r)),
    [searchParams],
  )
  const selectedMode = useMemo(
    () => parseModeParam(searchParams.get('mode')),
    [searchParams],
  )

  // Distinct data-crossing names present in the dataset, so we can validate
  // URL-supplied crossing slugs before using them. 33 values (El Paso rail
  // bridges share one row).
  const allDataCrossings = useMemo(() => {
    const s = new Set()
    for (const r of yearly || []) if (r.Crossing) s.add(r.Crossing)
    return s
  }, [yearly])

  const selectedCrossings = useMemo(
    () => parseCsvParam(searchParams.get('crossing')).filter((c) => allDataCrossings.has(c)),
    [searchParams, allDataCrossings],
  )

  const updateParams = useCallback((patch) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) {
          next.delete(k)
        } else if (Array.isArray(v)) {
          next.set(k, v.join(','))
        } else {
          next.set(k, String(v))
        }
      }
      return next
    }, { replace: true })
  }, [setSearchParams])

  const handleYearRangeChange = useCallback(({ startYear: s, endYear: e }) => {
    const isFullRange = s === minYear && e === maxYear
    updateParams({ year: isFullRange ? null : `${s}-${e}` })
  }, [updateParams, minYear, maxYear])

  const handleRegionChange = useCallback((vals) => {
    // Cascade: if regions are constrained, drop any selected crossings that
    // don't belong to the new region set. Full-region (vals==[]) keeps
    // crossings as-is.
    const patch = { region: vals }
    if (vals.length && selectedCrossings.length && yearly?.length) {
      const allowed = new Set()
      for (const r of yearly) {
        if (r.Crossing && vals.includes(r.Region)) allowed.add(r.Crossing)
      }
      const pruned = selectedCrossings.filter((c) => allowed.has(c))
      patch.crossing = pruned.length ? pruned : null
    }
    updateParams(patch)
  }, [updateParams, selectedCrossings, yearly])

  const handleModeChange = useCallback((mode) => {
    updateParams({ mode: mode === MODES[0] ? null : mode })
  }, [updateParams])

  const handleCrossingChange = useCallback((vals) => {
    updateParams({ crossing: vals })
  }, [updateParams])

  const handleResetAll = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setSearchParams])

  /* ── Filtered rows (respect year range, regions, crossings, mode) ── */
  const filteredYearly = useMemo(() => filterRows(yearly, {
    yearRange: { start: startYear, end: endYear },
    regions: selectedRegions,
    crossings: selectedCrossings,
    modes: [selectedMode],
  }), [yearly, startYear, endYear, selectedRegions, selectedCrossings, selectedMode])

  // Row slice ignoring the mode filter — used for displays (Mode Mix donut)
  // where splitting by mode is the whole point. Year range + region +
  // crossing still apply so the donut respects those sidebar choices.
  const filteredAllModes = useMemo(() => filterRows(yearly, {
    yearRange: { start: startYear, end: endYear },
    regions: selectedRegions,
    crossings: selectedCrossings,
  }), [yearly, startYear, endYear, selectedRegions, selectedCrossings])

  /* ── Monthly seasonality: last 3 years within the filter window ── */
  // Compare the calendar shape of each year so summer peaks / winter troughs
  // are visible. Respects region + mode; uses its own 3-year window rather
  // than the sidebar year-range because showing 10 lines is unreadable.
  const seasonalYears = useMemo(() => {
    if (maxYear == null) return []
    const hi = endYear ?? maxYear
    const lo = Math.max(startYear ?? minYear ?? hi - 2, hi - 2)
    const out = []
    for (let y = hi; y >= lo; y--) out.push(y)
    return out.sort((a, b) => a - b)
  }, [endYear, startYear, minYear, maxYear])

  const seasonalData = useMemo(() => {
    if (monthlyStatus !== 'ready' || !monthly?.length || !seasonalYears.length) return []
    const rows = filterRows(monthly, {
      yearRange: { start: seasonalYears[0], end: seasonalYears[seasonalYears.length - 1] },
      regions: selectedRegions,
      crossings: selectedCrossings,
      modes: [selectedMode],
    })
    // LineChart's legend geometry uses `name.length` — numeric series keys
    // produce NaN widths and collapse all entries onto one point. Cast year
    // to string so the legend renders each year separately.
    return monthlySeasonalSeries(rows, { years: seasonalYears })
      .map((d) => ({ ...d, year: String(d.year) }))
  }, [monthly, monthlyStatus, seasonalYears, selectedRegions, selectedCrossings, selectedMode])

  // Oldest → lightest, newest → TxDOT blue; keyed to match stringified years.
  const seasonalColorOverrides = useMemo(() => {
    const palette = ['#bfdbfe', '#60a5fa', '#0056a9']
    const out = {}
    seasonalYears.forEach((y, i) => {
      out[String(y)] = palette[Math.min(i, palette.length - 1)]
    })
    return out
  }, [seasonalYears])

  /* ── Stat card calculations ─────────────────────────────────────── */
  const latestFilteredYear = useMemo(() => {
    let y = null
    for (const r of filteredYearly) {
      if (r.Year != null && (y == null || r.Year > y)) y = r.Year
    }
    return y
  }, [filteredYearly])

  // Totals for each endpoint of the year-range filter (under the current
  // region + mode slice). The YoY card shows (end − start) / start so the
  // card reacts to the year-range filter: range 2016–2025 → change vs 2016.
  const { latestTotal, rangeStartTotal, pct, yoyCompareYear } = useMemo(() => {
    let latest = 0
    let start  = 0
    let latestYear = latestFilteredYear
    // Fall back to endYear when the filter has data but latestFilteredYear
    // was null (e.g. empty region + full data). Safe because endYear is
    // clamped to the data's max in the URL parser.
    if (latestYear == null) latestYear = endYear
    // Single-year range → no meaningful YoY; compare to prior calendar year
    // within the unfiltered data so the card still has *some* signal.
    const compare = (startYear != null && endYear != null && startYear !== endYear)
      ? startYear
      : (latestYear != null ? latestYear - 1 : null)

    for (const r of filteredYearly) {
      const v = r[VALUE_KEY] || 0
      if (r.Year === latestYear) latest += v
    }
    // For the compare endpoint we may need to reach outside the filtered range
    // (when start==end and we fall back to latestYear-1).
    if (compare != null) {
      if (compare >= startYear && compare <= endYear) {
        for (const r of filteredYearly) {
          if (r.Year === compare) start += (r[VALUE_KEY] || 0)
        }
      } else {
        for (const r of yearly) {
          if (r.Year !== compare) continue
          if (selectedRegions.length && !selectedRegions.includes(r.Region)) continue
          if (selectedCrossings.length && !selectedCrossings.includes(r.Crossing)) continue
          if (r.Modes !== selectedMode) continue
          start += (r[VALUE_KEY] || 0)
        }
      }
    }
    const pct = start ? (latest - start) / start : null
    return { latestTotal: latest, rangeStartTotal: start, pct, yoyCompareYear: compare }
  }, [filteredYearly, yearly, latestFilteredYear, startYear, endYear, selectedRegions, selectedCrossings, selectedMode])

  // "Crossings in Texas" — number of pins in selected regions. Uses the
  // authoritative coordinate list (34 rows) so El Paso Railroad Bridges
  // counts as two pins, matching what the map shows. When the Crossing
  // filter is set, count only pins whose data_crossing_name matches.
  const crossingCount = useMemo(() => {
    if (!coords?.length) return 0
    let rows = coords
    if (selectedRegions.length) rows = rows.filter((c) => selectedRegions.includes(c.region))
    if (selectedCrossings.length) {
      rows = rows.filter((c) => selectedCrossings.includes(c.data_crossing_name || c.crossing_name))
    }
    return rows.length
  }, [coords, selectedRegions, selectedCrossings])

  const topFive = useMemo(
    () => topCrossings(filteredYearly, latestFilteredYear, 5),
    [filteredYearly, latestFilteredYear],
  )
  const topLabel = topFive[0]?.label ?? '—'
  const topValue = topFive[0]?.value ?? 0

  /* ── Mode Mix donut — year constrained to the sidebar range; user can
       override the default (latest filtered year) via the in-card picker. ── */
  const donutYearsAvailable = useMemo(() => {
    if (!yearsAvailable?.length) return []
    return yearsAvailable.filter((y) => y >= startYear && y <= endYear)
  }, [yearsAvailable, startYear, endYear])

  const mixYearParam = useMemo(() => {
    const raw = searchParams.get('mixYear')
    if (!raw) return null
    const n = Number(raw)
    if (!Number.isFinite(n) || !donutYearsAvailable.includes(n)) return null
    return n
  }, [searchParams, donutYearsAvailable])

  const modeMixYear = mixYearParam ?? latestFilteredYear ?? endYear

  const handleMixYearChange = useCallback((year) => {
    updateParams({ mixYear: year == null ? null : String(year) })
  }, [updateParams])

  const modeMixData = useMemo(
    () => modeMix(filteredAllModes, modeMixYear),
    [filteredAllModes, modeMixYear],
  )

  /* ── Map markers: uniform dots; value threaded through but unused ── */
  const mapMarkers = useMemo(() => {
    if (!coords?.length) return []
    const totals = aggregateByDataCrossing(filteredYearly, { year: latestFilteredYear })
    let rows = buildMapCrossings(coords, totals)
    if (selectedRegions.length) rows = rows.filter((r) => selectedRegions.includes(r.region))
    if (selectedCrossings.length) {
      rows = rows.filter((r) => selectedCrossings.includes(r.dataCrossingName || r.name))
    }
    return rows
  }, [coords, filteredYearly, latestFilteredYear, selectedRegions, selectedCrossings])

  /* ── Trend chart data (year × region stacked) ─────────────────────── */
  const { data: trendData, keys: trendKeys } = useMemo(
    () => yearlyRegionSeries(filteredYearly),
    [filteredYearly],
  )

  /* ── Top-5 comparison — driven by sidebar filters ────────────────── */
  const compareDisabled = startYear == null || endYear == null || startYear === endYear
  const { startTop, endTop } = useMemo(() => {
    if (!yearly?.length || compareDisabled) {
      return { startTop: [], endTop: [] }
    }
    const startRows = filterRows(yearly, { year: startYear, regions: selectedRegions, crossings: selectedCrossings, modes: [selectedMode] })
    const endRows   = filterRows(yearly, { year: endYear,   regions: selectedRegions, crossings: selectedCrossings, modes: [selectedMode] })
    const startTop5 = topCrossings(startRows, null, 5)
    const endTop5   = topCrossings(endRows,   null, 5)
    const startLookup = new Map()
    for (const r of startRows) {
      const v = r[VALUE_KEY] || 0
      startLookup.set(r.Crossing, (startLookup.get(r.Crossing) || 0) + v)
    }
    const endTop = endTop5.map((d) => {
      const s = startLookup.get(d.label)
      const p = s ? (d.value - s) / s : null
      return { ...d, startValue: s ?? null, pct: p }
    })
    return { startTop: startTop5, endTop }
  }, [yearly, compareDisabled, startYear, endYear, selectedRegions, selectedCrossings, selectedMode])

  /* ── Sidebar filter tags + counts ─────────────────────────────────── */
  const isYearDefault = (minYear == null || maxYear == null)
    ? true
    : (startYear === minYear && endYear === maxYear)

  const activeCount =
    (isYearDefault ? 0 : 1) +
    (selectedRegions.length > 0 ? 1 : 0) +
    (selectedCrossings.length > 0 ? 1 : 0) +
    (selectedMode !== MODES[0] ? 1 : 0)

  const activeTags = useMemo(() => {
    const tags = []
    if (!isYearDefault) {
      tags.push({
        group: 'Years',
        label: `${startYear}–${endYear}`,
        onRemove: () => updateParams({ year: null }),
      })
    }
    for (const r of selectedRegions) {
      tags.push({
        group: 'Region',
        label: r,
        onRemove: () => handleRegionChange(selectedRegions.filter((x) => x !== r)),
      })
    }
    for (const c of selectedCrossings) {
      tags.push({
        group: 'Crossing',
        label: c,
        onRemove: () => handleCrossingChange(selectedCrossings.filter((x) => x !== c)),
      })
    }
    if (selectedMode !== MODES[0]) {
      tags.push({
        group: 'Mode',
        label: MODE_LABELS[selectedMode] || selectedMode,
        onRemove: () => handleModeChange(MODES[0]),
      })
    }
    return tags
  }, [isYearDefault, startYear, endYear, selectedRegions, selectedCrossings, selectedMode, updateParams, handleRegionChange, handleCrossingChange, handleModeChange])

  const filteredEmpty = filteredYearly.length === 0

  /* ── Crossing dropdown options: grouped by region, canonical N→S order
     within each group. Scoped to the selected regions when any are set. ── */
  const crossingGroups = useMemo(() => {
    if (!yearly?.length) return []
    // Collect distinct data-crossing names per region.
    const byRegion = new Map()
    for (const r of yearly) {
      if (!r.Crossing || !REGIONS.includes(r.Region)) continue
      if (selectedRegions.length && !selectedRegions.includes(r.Region)) continue
      if (!byRegion.has(r.Region)) byRegion.set(r.Region, new Set())
      byRegion.get(r.Region).add(r.Crossing)
    }
    const cmp = makeCrossingOrderComparator(coords)
    const regions = selectedRegions.length ? REGIONS.filter((r) => selectedRegions.includes(r)) : REGIONS
    return regions
      .filter((r) => byRegion.has(r))
      .map((r) => ({
        label: r,
        options: [...byRegion.get(r)].sort(cmp),
      }))
  }, [yearly, coords, selectedRegions])

  /* ── Sidebar ──────────────────────────────────────────────────────── */
  const sidebarFilters = (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 min-w-0 w-full">
        <span className="text-base font-medium text-text-secondary uppercase tracking-wider">
          Year Range
        </span>
        <YearRangeFilter
          years={yearsAvailable}
          startYear={startYear}
          endYear={endYear}
          onChange={handleYearRangeChange}
        />
      </div>
      <FilterCheckboxGroup
        label="Region"
        value={selectedRegions}
        options={REGIONS}
        onChange={handleRegionChange}
        allLabel="All regions"
        colorMap={REGION_COLORS}
      />
      <FilterMultiSelect
        label="Crossing"
        value={selectedCrossings}
        groups={crossingGroups}
        onChange={handleCrossingChange}
        allLabel="All crossings"
        searchable
      />
      <FilterRadioGroup
        label="Mode"
        name="overview-mode"
        value={selectedMode}
        options={MODES.map((m) => ({ value: m, label: MODE_LABELS[m] || m }))}
        onChange={handleModeChange}
        iconMap={MODE_ICON_MAP}
      />
    </div>
  )

  const pageDownload = filteredYearly.length > 0
    ? {
        data: filteredYearly,
        filename: `cbp-overview-${startYear}-${endYear}`,
        columns: PAGE_YEARLY_COLS,
      }
    : undefined

  const trendDir  = pct == null ? 'neutral' : pct >= 0 ? 'up' : 'down'
  const trendLabel = pct == null
    ? '—'
    : `${formatPercent(pct)} vs ${yoyCompareYear}`
  const modeLabel   = MODE_LABELS[selectedMode] || selectedMode
  const regionLabel = selectedRegions.length === 0
    ? 'All regions'
    : selectedRegions.length <= 2
      ? selectedRegions.join(', ')
      : `${selectedRegions.length} regions`
  const yoyCardLabel = (startYear != null && endYear != null && startYear !== endYear)
    ? `Change (${startYear}–${endYear})`
    : 'Year-over-Year Change'

  /* ── Hero (contains the map) ──────────────────────────────────────── */
  const hero = (
    <div className="gradient-blue text-white relative overflow-visible">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
        <div className="pt-7 pb-3 md:pt-9 md:pb-4">
          <h2 className="text-2xl md:text-3xl font-bold text-white text-balance">
            Texas–Mexico Border Crossings ({minYear || 2008}–{maxYear || 2025})
          </h2>
          <p className="text-white/80 mt-2 text-sm md:text-base leading-relaxed max-w-3xl">
            Northbound crossing counts at every Texas–Mexico port of entry, compiled
            from CBP data. Track headline totals and year-over-year change, see the
            regional trend alongside each year&rsquo;s mode mix, and compare the top
            five crossings between the start and end of your selected year range.
          </p>
        </div>
        <div className="pb-4 md:pb-5">
          <div className="rounded-xl overflow-hidden shadow-lg ring-1 ring-white/10" style={{ height: 540 }}>
            {mapMarkers.length > 0 ? (
              <CrossingsMap
                crossings={mapMarkers}
                height="540px"
                uniformDots
              />
            ) : (
              <div className="w-full h-full bg-white/5 flex items-center justify-center">
                <p className="text-white/40 text-sm">No crossings match the current filters.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <DashboardLayout
      hero={hero}
      filters={sidebarFilters}
      onResetAll={handleResetAll}
      activeCount={activeCount}
      activeTags={activeTags}
      pageDownload={pageDownload}
      filteredEmpty={filteredEmpty}
    >
      {/* ── Headline Stats ──────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-2">
        <section className="rounded-xl border border-border-light bg-surface-alt/50 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              label={`Total Northbound ${modeLabel} (${latestFilteredYear ?? '—'})`}
              value={formatNumber(latestTotal)}
              icon={Users}
              highlight
              variant="primary"
              delay={0}
            />
            <StatCard
              label={yoyCardLabel}
              value={pct == null ? '—' : `${pct >= 0 ? '+' : ''}${formatPercent(pct)}`}
              trend={trendDir}
              trendLabel={trendLabel}
              icon={pct == null ? Minus : pct >= 0 ? TrendingUp : TrendingDown}
              delay={100}
            />
            <StatCard
              label={`Crossings in Texas${selectedRegions.length > 0 ? ` (${regionLabel})` : ''}`}
              value={formatNumber(crossingCount)}
              icon={MapPin}
              delay={200}
            />
            <StatCard
              label={`Top Crossing (${latestFilteredYear ?? '—'})`}
              value={compactNumber(topValue)}
              trendLabel={topLabel}
              icon={Award}
              delay={300}
            />
          </div>
        </section>
      </div>

      {/* ── Trend (region-stacked) + Mode Mix donut, side by side ──── */}
      <SectionBlock alt>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
            <div className="flex flex-col">
              <div className="flex items-center gap-2.5 mb-4">
                <BarChart3 size={20} className="text-brand-blue" />
                <h3 className="text-xl font-bold text-text-primary">
                  Trend in NB Crossings
                </h3>
              </div>
              <ChartCard
                className="flex-1"
                hideTitle
                title="Trend in NB Crossings"
                subtitle={`Region: ${regionLabel} · Mode: ${modeLabel}`}
                downloadData={{
                  summary: {
                    data: trendData,
                    filename: `overview-trend-${startYear}-${endYear}`,
                    columns: {
                      year: 'Year',
                      ...Object.fromEntries(trendKeys.map((k) => [k, k])),
                    },
                  },
                }}
                emptyState={trendData.length === 0 ? 'No data matches the current filters.' : undefined}
              >
                <StackedBarChart
                  data={trendData}
                  xKey="year"
                  stackKeys={trendKeys}
                  colorOverrides={REGION_COLORS}
                  formatValue={formatCompact}
                />
              </ChartCard>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2.5 mb-4">
                <PieIcon size={20} className="text-brand-blue" />
                <h3 className="text-xl font-bold text-text-primary">
                  {modeMixYear ?? '—'} Mix by Mode
                </h3>
              </div>
              <ChartCard
                className="flex-1"
                hideTitle
                title={`Mode Mix (${modeMixYear ?? '—'})`}
                subtitle={`Share of total northbound crossings by mode · ${regionLabel}`}
                headerRight={
                  donutYearsAvailable.length > 1 ? (
                    <label className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
                      <span className="uppercase tracking-wider font-medium">Year</span>
                      <span className="relative inline-block">
                        <select
                          value={modeMixYear == null ? '' : String(modeMixYear)}
                          onChange={(e) => handleMixYearChange(e.target.value ? Number(e.target.value) : null)}
                          className="appearance-none px-2 py-1 pr-7 rounded-md border border-border bg-white
                                     text-sm text-text-primary cursor-pointer
                                     focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                          aria-label="Select year for mode mix"
                        >
                          {donutYearsAvailable.map((y) => (
                            <option key={y} value={String(y)}>{y}</option>
                          ))}
                        </select>
                        <ChevronDown
                          size={12}
                          className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-text-secondary"
                        />
                      </span>
                    </label>
                  ) : undefined
                }
                downloadData={{ summary: { data: modeMixData, filename: `mode-mix-${modeMixYear}`, columns: DL.modeRank } }}
                emptyState={modeMixData.length === 0 ? 'No data matches the current filters.' : undefined}
              >
                <DonutChart
                  data={modeMixData}
                  nameKey="label"
                  valueKey="value"
                  formatValue={compactNumber}
                  colorOverrides={MODE_COLORS}
                />
              </ChartCard>
            </div>
          </div>
        </div>
      </SectionBlock>

      {/* ── Top-5 Crossings Comparison (uses sidebar filters) ──────── */}
      <SectionBlock alt>
        <div className="flex items-center gap-2.5 mb-2">
          <BarChart3 size={20} className="text-brand-blue" />
          <h3 className="text-xl font-bold text-text-primary">
            Top 5 Northbound Crossings — Year-over-Year Comparison
          </h3>
        </div>
        <p className="text-base text-text-secondary mb-5">
          Each chart shows the top 5 crossings for that year; the end-year bars
          annotate the change vs the same crossing in the start year. Uses the
          region, mode, and year range from the sidebar.
        </p>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
          <div className="flex flex-col">
            <div className="flex items-center gap-2.5 mb-4">
              <Award size={20} className="text-brand-blue" />
              <h3 className="text-xl font-bold text-text-primary">
                Top 5 Crossings ({startYear ?? '—'})
              </h3>
            </div>
            <ChartCard
              className="flex-1"
              hideTitle
              title={`Top 5 Crossings (${startYear ?? '—'})`}
              subtitle={`${regionLabel} · ${modeLabel}`}
              downloadData={{ summary: { data: startTop, filename: `top-crossings-${startYear}`, columns: DL.crossingRank } }}
              emptyState={
                compareDisabled
                  ? 'Set a year range spanning two different years to compare.'
                  : startTop.length === 0
                    ? 'No data for the current filters.'
                    : undefined
              }
            >
              <BarChart
                data={startTop}
                xKey="label"
                yKey="value"
                horizontal
                formatValue={compactNumber}
                color={COMPARE_START_COLOR}
              />
            </ChartCard>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2.5 mb-4">
              <Award size={20} className="text-brand-blue" />
              <h3 className="text-xl font-bold text-text-primary">
                Top 5 Crossings ({endYear ?? '—'})
              </h3>
            </div>
            <ChartCard
              className="flex-1"
              hideTitle
              title={`Top 5 Crossings (${endYear ?? '—'})`}
              subtitle={`${regionLabel} · ${modeLabel} · change vs ${startYear ?? '—'}`}
              downloadData={{ summary: { data: endTop, filename: `top-crossings-${endYear}`, columns: DL.crossingRank } }}
              emptyState={
                compareDisabled
                  ? 'Set a year range spanning two different years to compare.'
                  : endTop.length === 0
                    ? 'No data for the current filters.'
                    : undefined
              }
            >
              <BarChart
                data={endTop}
                xKey="label"
                yKey="value"
                horizontal
                formatValue={compactNumber}
                color={COMPARE_END_COLOR}
                labelSegmentsAccessor={(d) => {
                  const v = compactNumber(d.value)
                  if (d.pct == null) return [{ text: v }]
                  const arrow = d.pct >= 0 ? '▲' : '▼'
                  const fill  = d.pct >= 0 ? DELTA_UP_COLOR : DELTA_DOWN_COLOR
                  const pctStr = `${Math.abs(d.pct * 100).toFixed(1)}%`
                  return [
                    { text: `${v}  ` },
                    { text: `${arrow} ${pctStr}`, fill, weight: '600' },
                  ]
                }}
              />
            </ChartCard>
          </div>
        </div>
      </SectionBlock>

      {/* ── Monthly Seasonality ───────────────────────────────────── */}
      <SectionBlock>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5 mb-2">
            <CalendarDays size={20} className="text-brand-blue" />
            <h3 className="text-xl font-bold text-text-primary">
              Monthly Seasonality — {modeLabel}
            </h3>
          </div>
          <p className="text-base text-text-secondary mb-5">
            Monthly northbound volume for the most recent {seasonalYears.length} years,
            overlaid by calendar month so seasonal peaks (summer travel, fall produce)
            line up for year-over-year comparison. Respects the Region and Mode filters.
          </p>
          <ChartCard
            hideTitle
            title={`Monthly Northbound ${modeLabel}`}
            subtitle={
              seasonalYears.length
                ? `${seasonalYears[0]}–${seasonalYears[seasonalYears.length - 1]} · ${regionLabel}`
                : regionLabel
            }
            emptyState={
              monthlyStatus === 'loading'
                ? 'Loading monthly dataset…'
                : monthlyStatus === 'error'
                  ? 'Monthly dataset failed to load.'
                  : seasonalData.length === 0
                    ? 'No monthly data for the current filters.'
                    : undefined
            }
            downloadData={{
              summary: {
                data: seasonalData.map((d) => ({
                  year: d.year,
                  month: d.month,
                  month_label: MONTH_LABELS[d.month - 1],
                  value: d.value,
                })),
                filename: `overview-seasonality-${selectedMode.replace(/\W+/g, '-').toLowerCase()}`,
                columns: {
                  year: 'Year',
                  month: 'Month',
                  month_label: 'Month Label',
                  value: 'Northbound Crossings',
                },
              },
            }}
          >
            <LineChart
              data={seasonalData}
              xKey="month"
              yKey="value"
              seriesKey="year"
              formatValue={formatCompact}
              formatX={(m) => MONTH_LABELS[(m - 1) % 12] || String(m)}
              colorOverrides={seasonalColorOverrides}
              animate={false}
            />
          </ChartCard>
        </div>
      </SectionBlock>

      {/* ── Navigation Cards ──────────────────────────────────────── */}
      <SectionBlock>
        <div className="max-w-7xl mx-auto">
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
              { path: '/by-region',   title: 'By Region',   desc: 'Side-by-side comparison of the El Paso, Laredo, and Rio Grande Valley Texas Border regions.' },
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
        </div>
      </SectionBlock>
    </DashboardLayout>
  )
}
