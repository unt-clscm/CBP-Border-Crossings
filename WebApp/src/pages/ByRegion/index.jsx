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
import { useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Map as MapIcon, Layers } from 'lucide-react'
import { useCrossingsStore } from '@/stores/crossingsStore'
import {
  MODES,
  REGIONS,
  MODE_LABELS,
  filterRows,
  yearlyModeSeries,
  totalCrossings,
  parseYearRangeParam,
} from '@/lib/cbpHelpers'
import { formatNumber, formatCompact, CHART_COLORS } from '@/lib/chartColors'
import { PAGE_YEARLY_COLS } from '@/lib/downloadColumns'
import { buildMapCrossings, aggregateByDataCrossing } from '@/hooks/useCrossingsMapData'

import DashboardLayout from '@/components/layout/DashboardLayout'
import SectionBlock from '@/components/ui/SectionBlock'
import ChartCard from '@/components/ui/ChartCard'
import StackedBarChart from '@/components/charts/StackedBarChart'
import CrossingsMap from '@/components/maps/CrossingsMap'
import FilterMultiSelect from '@/components/filters/FilterMultiSelect'
import YearRangeFilter from '@/components/filters/YearRangeFilter'

/* ── URL param (de)serialisation ────────────────────────────────────── */

function parseModeParam(raw) {
  if (!raw) return []
  const vals = String(raw).split(',').map((s) => s.trim()).filter(Boolean)
  return vals.filter((v) => MODES.includes(v))
}

/* ── Mode-share inline bar ──────────────────────────────────────────── */

// `rows` is already scoped to the active filter selection; the share is
// computed over that subset so the bar always reflects the user's choice.
function ModeShareBar({ rows, year }) {
  const data = useMemo(() => {
    if (!rows?.length || year == null) return []
    const inYear = rows.filter((r) => r.Year === year)
    const totals = new Map()
    let total = 0
    for (const r of inYear) {
      if (!r.Modes) continue
      const v = r['Northbound Crossing'] || 0
      totals.set(r.Modes, (totals.get(r.Modes) || 0) + v)
      total += v
    }
    if (total <= 0) return []
    return MODES
      .filter((m) => totals.has(m) && totals.get(m) > 0)
      .map((m) => ({
        mode: m,
        label: MODE_LABELS[m] || m,
        value: totals.get(m),
        pct: totals.get(m) / total,
        color: CHART_COLORS[MODES.indexOf(m) % CHART_COLORS.length],
      }))
  }, [rows, year])

  if (!data.length) {
    return (
      <div className="text-base text-text-secondary italic px-2 py-3">
        No data for {year}.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-base text-text-secondary">
        <span className="uppercase tracking-wider font-medium">
          Mode mix · {year}
        </span>
      </div>
      <div
        className="flex w-full h-3 rounded-full overflow-hidden ring-1 ring-border-light/60 bg-surface-alt"
        role="img"
        aria-label={`Mode share for ${year}`}
      >
        {data.map((d) => (
          <div
            key={d.mode}
            title={`${d.label}: ${formatCompact(d.value)} (${(d.pct * 100).toFixed(1)}%)`}
            style={{ width: `${d.pct * 100}%`, background: d.color }}
            className="h-full first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-base text-text-secondary">
        {data.map((d) => (
          <li key={d.mode} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: d.color }}
            />
            <span className="text-text-primary font-medium">{d.label}</span>
            <span>{(d.pct * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
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

  // Latest year present in the filtered window.
  const latestYearInRange = useMemo(() => {
    let y = null
    for (const r of rows) {
      if (r.Year != null && (y == null || r.Year > y)) y = r.Year
    }
    return y
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

        {/* Mode share for latest year in range */}
        {latestYearInRange != null && (
          <div className="pt-3 border-t border-border-light/60">
            <ModeShareBar rows={rows} year={latestYearInRange} />
          </div>
        )}
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
  const selectedModes = useMemo(
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

  const setModes = useCallback((modes) => {
    updateParams((p) => {
      if (!modes?.length) p.delete('mode')
      else p.set('mode', modes.join(','))
    })
  }, [updateParams])

  const resetAll = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setSearchParams])

  /* ── Filtered rows (shared across panels + map + download) ──────── */

  const filteredYearly = useMemo(() => (
    filterRows(yearly, {
      yearRange: { start: startYear, end: endYear },
      modes: selectedModes.length ? selectedModes : null,
    })
  ), [yearly, startYear, endYear, selectedModes])

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
    if (selectedModes.length > 0) n += 1
    return n
  }, [startYear, endYear, selectedModes, minYear, maxYear])

  const activeTags = useMemo(() => {
    const tags = []
    if (!(startYear === minYear && endYear === maxYear)) {
      tags.push({
        group: 'Years',
        label: `${startYear}–${endYear}`,
        onRemove: () => setYearRange({ startYear: minYear, endYear: maxYear }),
      })
    }
    selectedModes.forEach((m) => {
      tags.push({
        group: 'Mode',
        label: MODE_LABELS[m] || m,
        onRemove: () => setModes(selectedModes.filter((x) => x !== m)),
      })
    })
    return tags
  }, [startYear, endYear, minYear, maxYear, selectedModes, setYearRange, setModes])

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
      <FilterMultiSelect
        label="Mode"
        value={selectedModes}
        options={MODES.map((m) => ({ value: m, label: MODE_LABELS[m] || m }))}
        onChange={setModes}
        allLabel="All modes"
      />
    </div>
  )

  /* ── Page download (filtered yearly rows) ───────────────────────── */

  const pageDownload = {
    data: filteredYearly,
    filename: `cbp-by-region_${startYear}-${endYear}${selectedModes.length ? `_${selectedModes.length}modes` : ''}`,
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

      {/* ── Map ─────────────────────────────────────────────────── */}
      <SectionBlock alt>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5 mb-4">
            <MapIcon size={20} className="text-brand-blue" />
            <h3 className="text-xl font-bold text-text-primary">
              All 34 crossings, colored by region
            </h3>
          </div>
          <p className="text-base text-text-secondary leading-relaxed mb-4 max-w-3xl">
            Circle size reflects total northbound crossings in the
            {selectedModes.length > 0 ? ' filtered mode and ' : ' filtered '}
            year window ({startYear}–{endYear}). Click any pin to drill into
            its full history.
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
