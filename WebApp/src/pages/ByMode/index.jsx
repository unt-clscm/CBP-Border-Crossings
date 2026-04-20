/**
 * ByMode page — Northbound crossings by mode across the Texas–Mexico border.
 *
 * Shows three complementary views of the same filtered dataset:
 *   1. StackedBarChart — Year × Mode totals (one stack per mode)
 *   2. LineChart       — one line per mode across time
 *   3. ShareDonut grid — per-mode crossing contribution gauges
 *
 * Sidebar filters (round-trip to the URL query string):
 *   - Region      → ?region=El%20Paso,Laredo
 *   - Crossing    → ?crossing=...
 *
 * The Crossing Contribution card carries its own local year selector
 * (not persisted to the URL).
 */
import { useMemo, useCallback, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarChart3, LineChart as LineIcon, CalendarDays, Check, PieChart as PieIcon } from 'lucide-react'
import { useCrossingsStore } from '@/stores/crossingsStore'
import {
  MODES,
  MODE_LABELS,
  REGIONS,
  MONTH_LABELS,
  filterRows,
  yearlyModeSeries,
  monthlyModeHeatmap,
  makeCrossingOrderComparator,
  VALUE_KEY,
} from '@/lib/cbpHelpers'
import { CHART_COLORS, formatCompact, formatNumber } from '@/lib/chartColors'
import DashboardLayout from '@/components/layout/DashboardLayout'
import SectionBlock from '@/components/ui/SectionBlock'
import ChartCard from '@/components/ui/ChartCard'
import StackedBarChart from '@/components/charts/StackedBarChart'
import LineChart from '@/components/charts/LineChart'
import HeatmapChart from '@/components/charts/HeatmapChart'
import ShareDonut from '@/components/charts/ShareDonut'
import ModeIcon from '@/components/ui/ModeIcon'
import { DL, PAGE_YEARLY_COLS } from '@/lib/downloadColumns'

/* Region palette — mirrors the Overview/ByRegion chart palette so the
 * Region filter swatches stay consistent with the charts. */
const REGION_COLORS = {
  'El Paso':           '#d97706',
  'Laredo':            '#16a34a',
  'Rio Grande Valley': '#0056a9',
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  URL query-string helpers                                               */
/* ─────────────────────────────────────────────────────────────────────── */

/** Parse a comma-separated list; drops empties. */
function parseCsvParam(str) {
  if (!str) return []
  return str.split(',').map((s) => s.trim()).filter(Boolean)
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  Stable color map: each mode → fixed CHART_COLORS index                 */
/* ─────────────────────────────────────────────────────────────────────── */
const MODE_COLOR_OVERRIDES = MODES.reduce((acc, m, i) => {
  acc[m] = CHART_COLORS[i % CHART_COLORS.length]
  return acc
}, {})

/* ─────────────────────────────────────────────────────────────────────── */

export default function ByModePage() {
  const status         = useCrossingsStore((s) => s.status)
  const yearly         = useCrossingsStore((s) => s.yearly)
  const monthly        = useCrossingsStore((s) => s.monthly)
  const monthlyStatus  = useCrossingsStore((s) => s.monthlyStatus)
  const coords         = useCrossingsStore((s) => s.coords)
  const yearsAvailable = useCrossingsStore((s) => s.yearsAvailable)
  const minYear        = useCrossingsStore((s) => s.minYear)
  const maxYear        = useCrossingsStore((s) => s.maxYear)

  const [searchParams, setSearchParams] = useSearchParams()

  /* ── Parse filters from URL ──────────────────────────────────────── */
  const selectedRegions   = parseCsvParam(searchParams.get('region'))
  const selectedCrossings = parseCsvParam(searchParams.get('crossing'))

  /* ── URL updater — preserves other params, drops defaults ────────── */
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

  // When regions change, also prune any selected crossings that don't belong
  // to the new region set so the cascading Region → Crossing relationship
  // stays consistent.
  const handleRegionChange = useCallback((vals) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (!vals?.length) next.delete('region')
      else next.set('region', vals.join(','))

      const currentCrossings = parseCsvParam(next.get('crossing'))
      if (currentCrossings.length && vals?.length && yearly?.length) {
        const regionSet = new Set(vals)
        const valid = new Set()
        for (const r of yearly) {
          if (regionSet.has(r.Region) && r.Crossing) valid.add(r.Crossing)
        }
        const pruned = currentCrossings.filter((c) => valid.has(c))
        if (pruned.length) next.set('crossing', pruned.join(','))
        else next.delete('crossing')
      }
      return next
    }, { replace: true })
  }, [setSearchParams, yearly])

  const handleCrossingChange = useCallback((vals) => {
    updateParams({ crossing: vals })
  }, [updateParams])

  const handleResetAll = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setSearchParams])

  /* ── Canonical crossing options (north-to-south) ─────────────────── */
  // Scoped to the selected regions so the Crossing filter only surfaces
  // crossings that belong to the active region set (cascading Region →
  // Crossing). An empty region selection means "all regions".
  const crossingOptions = useMemo(() => {
    if (!yearly?.length) return []
    const regionSet = selectedRegions.length ? new Set(selectedRegions) : null
    const uniq = new Set()
    for (const r of yearly) {
      if (!r.Crossing) continue
      if (regionSet && !regionSet.has(r.Region)) continue
      uniq.add(r.Crossing)
    }
    const cmp = makeCrossingOrderComparator(coords)
    return [...uniq].sort(cmp)
  }, [yearly, coords, selectedRegions])

  /* ── Filtered rows (region + crossing scope, all years) ──────────── */
  const filters = useMemo(() => ({
    regions: selectedRegions,
    crossings: selectedCrossings,
  }), [selectedRegions, selectedCrossings])

  const filteredRows = useMemo(
    () => (yearly?.length ? filterRows(yearly, filters) : []),
    [yearly, filters],
  )

  /* ── Year selector local to the Crossing Contribution section ────── */
  const [perModeYear, setPerModeYear] = useState(null)
  useEffect(() => {
    if (maxYear != null && perModeYear == null) setPerModeYear(maxYear)
  }, [maxYear, perModeYear])

  /* ── Chart-ready data ────────────────────────────────────────────── */
  const { data: stackedData, keys: stackedKeys } = useMemo(
    () => yearlyModeSeries(filteredRows),
    [filteredRows],
  )

  // Long-format [{ year, Mode, value }] for LineChart multi-series
  const lineData = useMemo(() => {
    const out = []
    for (const row of stackedData) {
      for (const key of stackedKeys) {
        out.push({ year: row.year, Mode: key, value: row[key] || 0 })
      }
    }
    return out
  }, [stackedData, stackedKeys])

  /* ── Monthly seasonality heatmap (mode × month) ─────────────────── */
  // Shares are row-normalized (each mode's volume distributed across 12
  // months), so summer pedestrian/bus peaks and produce-season truck bumps
  // jump out regardless of absolute volume differences between modes.
  const filteredMonthly = useMemo(() => (
    monthlyStatus === 'ready' && monthly?.length ? filterRows(monthly, filters) : []
  ), [monthly, monthlyStatus, filters])

  const heatmapGroups = useMemo(
    () => monthlyModeHeatmap(filteredMonthly),
    [filteredMonthly],
  )

  const heatmapRows = useMemo(() => heatmapGroups.map((g) => ({
    rowLabel: g.mode,
    cells: g.cells.map((c) => ({ colKey: c.month, value: c.value, share: c.share })),
  })), [heatmapGroups])

  const heatmapColumns = useMemo(
    () => MONTH_LABELS.map((label, i) => ({ key: i + 1, label })),
    [],
  )

  const heatmapDownload = useMemo(() => heatmapGroups.flatMap((g) =>
    g.cells.map((c) => ({
      Mode: g.mode,
      Month: c.month,
      'Month Label': MONTH_LABELS[c.month - 1],
      'Northbound Crossings': c.value,
      'Share of Mode (%)': Number((c.share * 100).toFixed(2)),
    })),
  ), [heatmapGroups])

  /* ── Per-mode crossing contribution (for ShareDonut rows) ────────── */
  // Scoped to the local year selector so shares reflect a single year's
  // distribution, not a multi-year cumulative.
  const perModeBreakdown = useMemo(() => {
    if (perModeYear == null) return []
    const crossingCmp = makeCrossingOrderComparator(coords)
    const byMode = new Map() // mode → Map<crossing, value>
    for (const r of filteredRows) {
      if (r.Year !== perModeYear) continue
      if (!r.Modes || !r.Crossing) continue
      if (!byMode.has(r.Modes)) byMode.set(r.Modes, new Map())
      const bucket = byMode.get(r.Modes)
      bucket.set(r.Crossing, (bucket.get(r.Crossing) || 0) + (r[VALUE_KEY] || 0))
    }
    return MODES
      .filter((m) => byMode.has(m))
      .map((m) => {
        const bucket = byMode.get(m)
        const entries = [...bucket.entries()]
          .map(([crossing, value]) => ({ crossing, value }))
          .filter((e) => e.value > 0)
          .sort((a, b) => crossingCmp(a.crossing, b.crossing))
        const total = entries.reduce((s, e) => s + e.value, 0)
        const withShare = entries.map((e) => ({
          ...e,
          share: total > 0 ? e.value / total : 0,
        }))
        return { mode: m, total, entries: withShare }
      })
      .filter((g) => g.entries.length > 0)
  }, [filteredRows, coords, perModeYear])

  /* ── Shared helpers for sidebar tags & active count ──────────────── */
  const activeCount =
    (selectedRegions.length > 0 ? 1 : 0) +
    (selectedCrossings.length > 0 ? 1 : 0)

  const activeTags = useMemo(() => {
    const tags = []
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
    return tags
  }, [selectedRegions, selectedCrossings, handleRegionChange, handleCrossingChange])

  /* ── Loading guard ───────────────────────────────────────────────── */
  // Render nothing (beyond the spinner) until the store is ready — otherwise
  // the year-range filter mounts with null min/max and can write a stale
  // ?year= param before the real bounds arrive.
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

  const filteredEmpty = filteredRows.length === 0

  /* ── Sidebar filters JSX ─────────────────────────────────────────── */
  const sidebarFilters = (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div className="flex flex-col gap-1 min-w-0 w-full">
        <span className="text-base font-medium text-text-secondary uppercase tracking-wider">
          Region
        </span>
        <div role="group" aria-label="Region" className="flex flex-col mt-1">
          {(() => {
            const allSelected = selectedRegions.length === 0
            return (
              <label
                className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors ${
                  allSelected ? 'bg-brand-blue/10' : 'hover:bg-brand-blue/5'
                }`}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => handleRegionChange([])}
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
                  All regions
                </span>
              </label>
            )
          })()}
          {REGIONS.map((r) => {
            const selected = selectedRegions.includes(r)
            const color = REGION_COLORS[r]
            const rowStyle = selected
              ? { backgroundColor: `${color}1A` }
              : undefined
            const boxStyle = selected
              ? { backgroundColor: color, borderColor: color }
              : undefined
            return (
              <label
                key={r}
                style={rowStyle}
                className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors ${
                  selected ? '' : 'hover:bg-brand-blue/5'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {
                    if (selected) {
                      handleRegionChange(selectedRegions.filter((x) => x !== r))
                    } else {
                      const next = [...selectedRegions, r]
                      handleRegionChange(next.length === REGIONS.length ? [] : next)
                    }
                  }}
                  className="sr-only"
                />
                <span
                  style={boxStyle}
                  className={`flex-shrink-0 flex items-center justify-center w-4 h-4 rounded border ${
                    selected ? '' : 'border-border'
                  }`}
                >
                  {selected && <Check size={12} className="text-white" />}
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
            const allSelected = selectedCrossings.length === 0
            return (
              <label
                className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors ${
                  allSelected ? 'bg-brand-blue/10' : 'hover:bg-brand-blue/5'
                }`}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => handleCrossingChange([])}
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
            const selected = selectedCrossings.includes(c)
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
                      handleCrossingChange(selectedCrossings.filter((x) => x !== c))
                    } else {
                      const next = [...selectedCrossings, c]
                      handleCrossingChange(next.length === crossingOptions.length ? [] : next)
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

  /* ── Page-level CSV download (filtered yearly rows) ──────────────── */
  const pageDownload = filteredRows.length > 0
    ? {
        data: filteredRows,
        filename: `cbp-by-mode`,
        columns: PAGE_YEARLY_COLS,
      }
    : undefined

  /* ── Hero ────────────────────────────────────────────────────────── */
  const hero = (
    <div className="gradient-blue text-white relative overflow-visible">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative py-8 md:py-10">
        <h2 className="text-2xl md:text-3xl font-bold text-white text-balance">
          Northbound Crossings by Mode
        </h2>
        <p className="text-white/80 mt-2 text-sm md:text-base leading-relaxed max-w-3xl">
          How each of the five CBP-reported modes — trucks, buses, pedestrians/bicyclists,
          passenger vehicles, and railcars — has moved across the Texas–Mexico border over
          time. Stacked yearly totals show the overall mix, a multi-line trend isolates each
          mode&rsquo;s trajectory, and per-crossing gauge rings show how each border bridge
          contributes to its mode for a single year. Narrow the view by region or crossing
          using the sidebar.
        </p>
      </div>
    </div>
  )

  /* ── Subtitle for year-spanning charts ───────────────────────────── */
  const yearSubtitle = minYear != null && maxYear != null
    ? `Texas–Mexico northbound, ${minYear}–${maxYear}`
    : 'Texas–Mexico northbound'

  /* ── Flat CSV download for the per-mode breakdown ────────────────── */
  const breakdownDownloadData = perModeBreakdown.flatMap((g) =>
    g.entries.map((e) => ({
      Mode: g.mode,
      Crossing: e.crossing,
      'Northbound Crossings': e.value,
      'Mode Total': g.total,
      'Share of Mode (%)': Number((e.share * 100).toFixed(2)),
    })),
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
      {/* ── Stacked bar chart ───────────────────────────────────────── */}
      <SectionBlock>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5 mb-5">
            <BarChart3 size={20} className="text-brand-blue" />
            <h3 className="text-xl font-bold text-text-primary">Mode totals by year</h3>
          </div>
          <ChartCard
            hideTitle
            title="Northbound Crossings by Mode"
            subtitle={yearSubtitle}
            downloadData={{
              summary: {
                data: stackedData,
                filename: `mode-by-year`,
                columns: {
                  year: 'Year',
                  ...Object.fromEntries(stackedKeys.map((k) => [k, k])),
                },
              },
            }}
            emptyState={
              stackedData.length === 0
                ? 'No crossings match the current filters.'
                : undefined
            }
          >
            <StackedBarChart
              data={stackedData}
              xKey="year"
              stackKeys={stackedKeys}
              formatValue={formatCompact}
            />
          </ChartCard>
        </div>
      </SectionBlock>

      {/* ── Line charts — one small-multiple per mode ───────────────── */}
      <SectionBlock alt>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5 mb-2">
            <LineIcon size={20} className="text-brand-blue" />
            <h3 className="text-xl font-bold text-text-primary">Mode trends over time</h3>
          </div>
          <p className="text-base text-text-secondary mb-5 max-w-3xl">
            One panel per mode, each with its own y-axis scale so low-volume
            modes (Buses, Railcars, Commercial Trucks) stay legible alongside
            Passenger Vehicles and Pedestrians.
          </p>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {MODES.map((mode) => {
              const modeRows = lineData.filter((d) => d.Mode === mode)
              const hasData = modeRows.some((d) => d.value > 0)
              const color = MODE_COLOR_OVERRIDES[mode]
              return (
                <ChartCard
                  key={mode}
                  title={MODE_LABELS[mode] || mode}
                  subtitle={yearSubtitle}
                  minHeight={280}
                  emptyState={
                    !hasData
                      ? 'No crossings match the current filters.'
                      : undefined
                  }
                  downloadData={{
                    summary: {
                      data: modeRows,
                      filename: `mode-trend-${mode.replace(/[\s/]+/g, '-').toLowerCase()}`,
                      columns: DL.crossingsTrendSeries,
                    },
                  }}
                >
                  <LineChart
                    data={modeRows}
                    xKey="year"
                    yKey="value"
                    formatValue={formatCompact}
                    colorOverrides={{ default: color }}
                    showArea
                    ariaLabel={`${MODE_LABELS[mode] || mode} trend`}
                  />
                </ChartCard>
              )
            })}
          </div>
        </div>
      </SectionBlock>

      {/* ── Month × Mode seasonality heatmap ────────────────────── */}
      <SectionBlock>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5 mb-2">
            <CalendarDays size={20} className="text-brand-blue" />
            <h3 className="text-xl font-bold text-text-primary">Seasonality by mode</h3>
          </div>
          <p className="text-base text-text-secondary mb-5 max-w-3xl">
            Share of each mode&rsquo;s total volume that falls in each calendar
            month, summed across all years in the window. Hotter cells mean a
            bigger chunk of that mode&rsquo;s traffic happens that month — surfacing
            summer pedestrian peaks, produce-season truck bumps, and winter dips.
          </p>
          <ChartCard
            hideTitle
            title="Monthly share by mode"
            subtitle={yearSubtitle}
            emptyState={
              monthlyStatus === 'loading'
                ? 'Loading monthly dataset…'
                : monthlyStatus === 'error'
                  ? 'Monthly dataset failed to load.'
                  : heatmapRows.length === 0
                    ? 'No monthly data for the current filters.'
                    : undefined
            }
            downloadData={{
              summary: {
                data: heatmapDownload,
                filename: `mode-seasonality`,
                columns: {
                  Mode: 'Mode',
                  Month: 'Month',
                  'Month Label': 'Month Label',
                  'Northbound Crossings': 'Northbound Crossings',
                  'Share of Mode (%)': 'Share of Mode (%)',
                },
              },
            }}
          >
            <HeatmapChart
              rows={heatmapRows}
              columns={heatmapColumns}
              formatValue={formatCompact}
              renderRowLabel={(mode) => (
                <span className="inline-flex items-center gap-2">
                  <ModeIcon mode={mode} size={18} className="text-text-secondary" />
                  <span className="font-medium">{MODE_LABELS[mode] || mode}</span>
                </span>
              )}
            />
          </ChartCard>
        </div>
      </SectionBlock>

      {/* ── Per-mode crossing contribution (ShareDonut grid) ───────── */}
      <SectionBlock>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5 mb-5">
            <PieIcon size={20} className="text-brand-blue" />
            <h3 className="text-xl font-bold text-text-primary">
              Crossing contribution by mode{perModeYear ? ` (${perModeYear})` : ''}
            </h3>
          </div>
          <ChartCard
            hideTitle
            title={`Crossing Contribution by Mode${perModeYear ? ` (${perModeYear})` : ''}`}
            subtitle="Each ring shows how much a single crossing contributed to its mode's total for the selected year. Shares within a row sum to 100%."
            minHeight={0}
            headerRight={
              <label className="flex items-center gap-1.5 text-sm text-text-secondary">
                <span>Year</span>
                <select
                  value={perModeYear ?? ''}
                  onChange={(e) => setPerModeYear(Number(e.target.value))}
                  className="border border-border rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                >
                  {(yearsAvailable || []).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>
            }
            downloadData={{
              summary: {
                data: breakdownDownloadData,
                filename: `mode-crossing-shares-${perModeYear ?? 'year'}`,
                columns: {
                  Mode: 'Mode',
                  Crossing: 'Crossing',
                  'Northbound Crossings': 'Northbound Crossings',
                  'Mode Total': 'Mode Total',
                  'Share of Mode (%)': 'Share of Mode (%)',
                },
              },
            }}
            emptyState={
              perModeBreakdown.length === 0
                ? 'No crossings match the current filters for this year.'
                : undefined
            }
          >
            <div className="flex flex-col divide-y divide-border-light">
              {perModeBreakdown.map((group, i) => {
                const color = CHART_COLORS[MODES.indexOf(group.mode) % CHART_COLORS.length]
                return (
                  <div key={group.mode} className={`${i === 0 ? 'pt-1' : 'pt-6'} pb-6`}>
                    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span style={{ color }} className="inline-flex">
                          <ModeIcon mode={group.mode} size={22} />
                        </span>
                        <h4 className="text-base font-semibold text-text-primary truncate">
                          {MODE_LABELS[group.mode] || group.mode}
                        </h4>
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${color}1A`, color }}
                        >
                          {group.entries.length} crossing{group.entries.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="text-sm text-text-secondary whitespace-nowrap">
                        Mode total:{' '}
                        <span className="font-semibold text-text-primary">
                          {formatNumber(group.total)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-5 justify-start">
                      {group.entries.map((e) => (
                        <ShareDonut
                          key={`${group.mode}-${e.crossing}`}
                          share={e.share}
                          label={e.crossing}
                          value={e.value}
                          formatValue={formatCompact}
                          color={color}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </ChartCard>
        </div>
      </SectionBlock>
    </DashboardLayout>
  )
}
