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
import { MapPin, TrendingUp, TrendingDown, Table as TableIcon, Percent, Grid2x2, PieChart as PieChartIcon, CalendarDays, Check } from 'lucide-react'

import { useCrossingsStore } from '@/stores/crossingsStore'
import {
  MODES,
  MODE_LABELS,
  REGIONS,
  MONTH_LABELS,
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
import YearRangeFilter from '@/components/filters/YearRangeFilter'
import ModeIcon from '@/components/ui/ModeIcon'

/* Region palette — mirrors the Overview/ByRegion chart palette so the
 * Region filter card and the charts share a consistent color identity. */
const REGION_COLORS = {
  'El Paso':           '#d97706',
  'Laredo':            '#16a34a',
  'Rio Grande Valley': '#0056a9',
}

/* Mode palette — matches the Overview page so mode identity is consistent. */
const MODE_COLORS = {
  'Commercial Trucks':       '#6d28d9',
  'Buses':                   '#be123c',
  'Pedestrians/ Bicyclists': '#0d9488',
  'Passenger Vehicles':      '#2563eb',
  'Railcars':                '#facc15',
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
  const monthly        = useCrossingsStore((s) => s.monthly)
  const monthlyStatus  = useCrossingsStore((s) => s.monthlyStatus)
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
  // Also prune any selected crossings that don't belong to the new region,
  // so the cascading Region → Crossing relationship stays consistent.
  const setRegion = useCallback((newRegion) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (!newRegion) next.delete('region')
      else next.set('region', newRegion)

      const currentCrossings = parseMulti(next.get('crossing'))
      if (currentCrossings.length && newRegion && yearly?.length) {
        const valid = new Set()
        for (const r of yearly) {
          if (r.Region === newRegion && r.Crossing) valid.add(r.Crossing)
        }
        const pruned = currentCrossings.filter((c) => valid.has(c))
        if (pruned.length) next.set('crossing', pruned.join(','))
        else next.delete('crossing')
      }
      return next
    }, { replace: true })
  }, [setSearchParams, yearly])

  const setCrossings = useCallback((v) => updateParam('crossing', joinMulti(v)), [updateParam])

  const resetAll = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setSearchParams])

  /* ─── Derived data (guarded until store ready) ──────────────────────── */

  // Distinct crossings sorted north-to-south, scoped to the active region so
  // the Crossing filter only surfaces crossings that belong to the selected
  // region (cascading Region → Crossing).
  const crossingOptions = useMemo(() => {
    if (!yearly?.length) return []
    const region = filters.regions[0]
    const s = new Set()
    for (const r of yearly) {
      if (!r.Crossing) continue
      if (region && r.Region !== region) continue
      s.add(r.Crossing)
    }
    const cmp = makeCrossingOrderComparator(coords)
    return [...s].sort(cmp)
  }, [yearly, coords, filters.regions])

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

  /* ─── Monthly seasonality (per-crossing, per-year) ──────────────────── */
  // Shows the intra-year shape: one line per mode, x = month. Single-year
  // snapshot so month-to-month swings are legible; local year picker defaults
  // to the most recent year.
  const [seasonalYear, setSeasonalYear] = useState(null)
  useEffect(() => {
    if (maxYear != null && seasonalYear == null) setSeasonalYear(maxYear)
  }, [maxYear, seasonalYear])

  const seasonalRows = useMemo(() => {
    if (monthlyStatus !== 'ready' || !monthly?.length || seasonalYear == null) return []
    // Reuse sidebar region + crossing filters but pin to the single selected year.
    const base = filterRows(monthly, {
      year: seasonalYear,
      regions: filters.regions,
      crossings: filters.crossings,
    })
    // One point per (month, mode). Build by summing across whatever crossings
    // matched the sidebar filter.
    const bucket = new Map() // `${month}|${mode}` → sum
    const modeSet = new Set()
    for (const r of base) {
      if (!r.Modes || !Number.isFinite(r.Month)) continue
      modeSet.add(r.Modes)
      const k = `${r.Month}|${r.Modes}`
      bucket.set(k, (bucket.get(k) || 0) + (r[VALUE_KEY] || 0))
    }
    const modes = MODES.filter((m) => modeSet.has(m))
    const out = []
    for (let m = 1; m <= 12; m++) {
      for (const mode of modes) {
        out.push({ month: m, Mode: mode, value: bucket.get(`${m}|${mode}`) || 0 })
      }
    }
    return out
  }, [monthly, monthlyStatus, seasonalYear, filters.regions, filters.crossings])

  /* ─── Percentage-change section ───────────────────────────────────────── */
  // Uses the sidebar year range's endpoints as the two comparison years.
  const pctStartYear = filters.startYear
  const pctEndYear   = filters.endYear

  const pctRows = useMemo(() => {
    if (!yearly?.length || pctStartYear == null || pctEndYear == null) return []

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

    // Explicit column widths: Crossing takes a narrow-ish left slice and all
    // five mode columns share the remaining 75% equally (15% each). `wrap`
    // lets multi-word mode labels like "Pedestrians/ Bicyclists" break onto a
    // second header line instead of overflowing into neighboring columns.
    return [
      { key: 'Crossing', label: 'Crossing', width: '25%', wrap: true },
      ...MODES.map((m) => ({
        key: m,
        label: MODE_LABELS[m] || m,
        headerIcon: <ModeIcon mode={m} size={20} className="text-text-secondary" />,
        render: renderPct,
        width: '15%',
        wrap: true,
      })),
    ]
  }, [])

  /* ─── Map markers ───────────────────────────────────────────────────── */
  // Only show crossings in the active region so the map zooms to that
  // region's bridges. Bounds are fit from the returned markers.
  const mapMarkers = useMemo(() => {
    if (!coords?.length || !yearly?.length) return []
    const region = filters.regions[0]
    const scopedCoords = region ? coords.filter((c) => c.region === region) : coords
    const totals = aggregateByDataCrossing(filteredYearly)
    return buildMapCrossings(scopedCoords, totals)
  }, [coords, yearly, filteredYearly, filters.regions])

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
    <div className="flex flex-col gap-4 h-full min-h-0">
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
        <div role="radiogroup" aria-label="Region" className="flex flex-col mt-1">
          {REGIONS.map((r) => {
            const selected = filters.regions[0] === r
            const color = REGION_COLORS[r]
            const rowStyle = selected
              ? { backgroundColor: `${color}1A` }
              : undefined
            return (
              <label
                key={r}
                style={rowStyle}
                className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors ${selected ? '' : 'hover:bg-brand-blue/5'}`}
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

      <div className="flex flex-col gap-1 min-w-0 w-full flex-1 min-h-0">
        <span className="text-base font-medium text-text-secondary uppercase tracking-wider">
          Crossing
        </span>
        <div role="group" aria-label="Crossing" className="flex flex-col mt-1 flex-1 min-h-0 overflow-y-auto">
          {(() => {
            const allSelected = filters.crossings.length === 0
            return (
              <label
                className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors ${
                  allSelected ? 'bg-brand-blue/10' : 'hover:bg-brand-blue/5'
                }`}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setCrossings([])}
                  className="sr-only"
                />
                <span
                  className={`flex-shrink-0 flex items-center justify-center w-4 h-4 rounded border ${
                    allSelected ? 'bg-brand-blue border-brand-blue' : 'border-border'
                  }`}
                >
                  {allSelected && <Check size={12} className="text-white" />}
                </span>
                <span className={`text-sm ${allSelected ? 'text-brand-blue font-medium' : 'text-text-primary'}`}>
                  All crossings
                </span>
              </label>
            )
          })()}
          {crossingOptions.map((c) => {
            const selected = filters.crossings.includes(c)
            return (
              <label
                key={c}
                className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors ${
                  selected ? 'bg-brand-blue/10' : 'hover:bg-brand-blue/5'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {
                    if (selected) {
                      setCrossings(filters.crossings.filter((x) => x !== c))
                    } else {
                      const next = [...filters.crossings, c]
                      setCrossings(next.length === crossingOptions.length ? [] : next)
                    }
                  }}
                  className="sr-only"
                />
                <span
                  className={`flex-shrink-0 flex items-center justify-center w-4 h-4 rounded border ${
                    selected ? 'bg-brand-blue border-brand-blue' : 'border-border'
                  }`}
                >
                  {selected && <Check size={12} className="text-white" />}
                </span>
                <span className={`text-sm whitespace-nowrap ${selected ? 'text-brand-blue font-medium' : 'text-text-primary'}`}>
                  {c}
                </span>
              </label>
            )
          })}
        </div>
      </div>
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
          Drill into any of the 34 Texas–Mexico northbound crossings. Compare
          yearly trends by mode, see how a single mode is distributed across
          every crossing in a region, and measure percentage change between
          years. Filter by year range, region, or specific crossing — all
          selections round-trip through the URL so the view is shareable and
          refresh-safe.
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
            ? `Highlighted pins match the crossings selected in the Crossing filter within the ${filters.regions[0]} region.`
            : `Crossings in the ${filters.regions[0]} region. Color marks the Texas Border region.`}
        </p>
        <div className="rounded-xl overflow-hidden shadow-sm ring-1 ring-border-light" style={{ height: 400 }}>
          {mapMarkers.length > 0 ? (
            <CrossingsMap
              crossings={mapMarkers}
              height="400px"
              metricLabel="crossings (filtered)"
              highlightNames={highlightNames}
              uniformDots
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
          hideTitle
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

      {/* ─── Monthly seasonality — small multiples per mode ─────────────── */}
      <SectionBlock>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <div className="flex items-center gap-2.5">
            <CalendarDays size={20} className="text-brand-blue" />
            <h3 className="text-xl font-bold text-text-primary">Monthly Pattern</h3>
          </div>
          <label className="inline-flex items-center gap-1.5 text-sm text-text-secondary">
            <span>Year</span>
            <select
              value={seasonalYear ?? ''}
              onChange={(e) => setSeasonalYear(Number(e.target.value))}
              className="border border-border rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
            >
              {(yearsAvailable || []).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-base text-text-secondary leading-relaxed mb-4 max-w-3xl">
          Month-to-month volume for a single year, one chart per mode so each
          mode has its own y-axis. Reveals seasonality that yearly totals and
          a shared-scale chart both hide — e.g. the late-spring Pedestrian dip
          or the summer Bus peak.
        </p>
        {monthlyStatus === 'loading' && (
          <div className="bg-white rounded-xl border border-border-light shadow-xs p-8 text-center">
            <p className="text-base text-text-secondary">Loading monthly dataset…</p>
          </div>
        )}
        {monthlyStatus === 'error' && (
          <div className="bg-white rounded-xl border border-border-light shadow-xs p-8 text-center">
            <p className="text-base text-text-secondary">Monthly dataset failed to load.</p>
          </div>
        )}
        {monthlyStatus === 'ready' && seasonalRows.length === 0 && (
          <div className="bg-white rounded-xl border border-border-light shadow-xs p-8 text-center">
            <p className="text-base text-text-secondary">No monthly data for the current filters.</p>
          </div>
        )}
        {monthlyStatus === 'ready' && seasonalRows.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MODES.map((mode) => {
              const rows = seasonalRows.filter((r) => r.Mode === mode)
              const hasVolume = rows.some((r) => r.value > 0)
              const color = MODE_COLORS[mode]
              const scopeLabel = filters.crossings.length === 1
                ? filters.crossings[0]
                : filters.crossings.length > 1
                  ? `${filters.crossings.length} crossings · ${filters.regions[0]}`
                  : `all crossings · ${filters.regions[0]}`
              return (
                <ChartCard
                  key={mode}
                  title={MODE_LABELS[mode] || mode}
                  subtitle={`${seasonalYear ?? '—'} · ${scopeLabel}`}
                  titleClassName="text-base font-semibold text-text-primary leading-snug"
                  subtitleClassName="text-xs text-text-secondary mt-0.5"
                  minHeight={220}
                  emptyState={!hasVolume ? `No ${MODE_LABELS[mode] || mode} volume this year.` : undefined}
                  downloadData={{
                    summary: {
                      data: rows.map((d) => ({
                        Year: seasonalYear,
                        Month: d.month,
                        'Month Label': MONTH_LABELS[d.month - 1],
                        Mode: d.Mode,
                        'Northbound Crossings': d.value,
                      })),
                      filename: `by-crossing-monthly-${mode.replace(/\W+/g, '-').toLowerCase()}-${seasonalYear}`,
                      columns: {
                        Year: 'Year',
                        Month: 'Month',
                        'Month Label': 'Month Label',
                        Mode: 'Mode',
                        'Northbound Crossings': 'Northbound Crossings',
                      },
                    },
                  }}
                >
                  <LineChart
                    data={rows}
                    xKey="month"
                    yKey="value"
                    formatValue={formatCompact}
                    formatX={(m) => MONTH_LABELS[(m - 1) % 12] || String(m)}
                    colorOverrides={{ default: color }}
                    showArea
                    animate={false}
                  />
                </ChartCard>
              )
            })}
          </div>
        )}
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
          hideTitle
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
                maxSize={620}
              />
            )}
          </div>
        </ChartCard>
      </SectionBlock>

      {/* ─── Percentage change matrix ──────────────────────────────────── */}
      <SectionBlock>
        {pctRows.length > 0 && pctColumns.length > 1 ? (
          // Full-width layout so the explicit column widths on pctColumns
          // resolve against the available page width — gives every mode
          // column an identical 14% slice.
          <div className="w-full">
            <div className="mb-4">
              <div className="flex items-center gap-2.5 mb-2">
                <Percent size={20} className="text-brand-blue" />
                <h3 className="text-xl font-bold text-text-primary">
                  Percentage Change by Crossing &amp; Mode
                </h3>
              </div>
              <p className="text-base text-text-secondary leading-relaxed max-w-3xl">
                How northbound volume shifted at each crossing between the
                start and end of the selected year range. Empty cells mean no
                activity in one or both endpoint years, so a percentage change
                can&rsquo;t be computed. All sidebar filters apply.
              </p>
            </div>
            <DataTable
              columns={pctColumns}
              data={pctRows}
              pageSize={50}
              fullWidth
            />
          </div>
        ) : (
          <>
            <div className="mb-4">
              <div className="flex items-center gap-2.5 mb-2">
                <Percent size={20} className="text-brand-blue" />
                <h3 className="text-xl font-bold text-text-primary">
                  Percentage Change by Crossing &amp; Mode
                </h3>
              </div>
              <p className="text-base text-text-secondary leading-relaxed max-w-3xl">
                How northbound volume shifted at each crossing between the
                start and end of the selected year range. Empty cells mean no
                activity in one or both endpoint years, so a percentage change
                can&rsquo;t be computed. All sidebar filters apply.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-border-light shadow-xs p-8 text-center">
              <p className="text-base text-text-secondary">
                No crossings match the current region / crossing / mode filters.
              </p>
            </div>
          </>
        )}
      </SectionBlock>

      {/* ─── Detail table ──────────────────────────────────────────────── */}
      <SectionBlock>
        {filteredYearly.length > 0 ? (
          // Wrapper is sized to the table (w-fit) and centered. The text block
          // uses w-0 min-w-full so its intrinsic width doesn't push the wrapper
          // wider than the table — title/subtitle stay aligned with the table's
          // left and right edges.
          <div className="mx-auto w-fit max-w-full">
            <div className="w-0 min-w-full mb-4">
              <div className="flex items-center gap-2.5 mb-2">
                <TableIcon size={20} className="text-brand-blue" />
                <h3 className="text-xl font-bold text-text-primary">Detail Table</h3>
              </div>
              <p className="text-base text-text-secondary leading-relaxed">
                One row per Year × Crossing × Mode. Click column headers to sort; use
                the Download button in the filter panel to export the filtered rows.
              </p>
            </div>
            <DataTable
              columns={tableColumns}
              data={filteredYearly}
              pageSize={25}
            />
          </div>
        ) : (
          <>
            <div className="mb-4">
              <div className="flex items-center gap-2.5 mb-2">
                <TableIcon size={20} className="text-brand-blue" />
                <h3 className="text-xl font-bold text-text-primary">Detail Table</h3>
              </div>
              <p className="text-base text-text-secondary leading-relaxed max-w-3xl">
                One row per Year × Crossing × Mode. Click column headers to sort; use
                the Download button in the filter panel to export the filtered rows.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-border-light shadow-xs p-8 text-center">
              <p className="text-base text-text-secondary">
                No rows match the current filter selection.
              </p>
            </div>
          </>
        )}
      </SectionBlock>
    </DashboardLayout>
  )
}
