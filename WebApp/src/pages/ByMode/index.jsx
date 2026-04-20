/**
 * ByMode page — Northbound crossings by mode across the Texas–Mexico border.
 *
 * Shows three complementary views of the same filtered dataset:
 *   1. StackedBarChart — Year × Mode totals (one stack per mode)
 *   2. LineChart       — one line per mode across time
 *   3. DataTable       — mode totals & share within the selected year range
 *
 * Sidebar filters (round-trip to the URL query string):
 *   - Year range  → ?year=2015-2025
 *   - Region      → ?region=El%20Paso,Laredo
 *   - Crossing    → ?crossing=...
 */
import { useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarChart3, LineChart as LineIcon, Table as TableIcon } from 'lucide-react'
import { useCrossingsStore } from '@/stores/crossingsStore'
import {
  MODES,
  REGIONS,
  filterRows,
  yearlyModeSeries,
  makeCrossingOrderComparator,
  parseYearRangeParam,
} from '@/lib/cbpHelpers'
import { CHART_COLORS, formatCompact, formatNumber, formatPercent } from '@/lib/chartColors'
import DashboardLayout from '@/components/layout/DashboardLayout'
import SectionBlock from '@/components/ui/SectionBlock'
import ChartCard from '@/components/ui/ChartCard'
import StackedBarChart from '@/components/charts/StackedBarChart'
import LineChart from '@/components/charts/LineChart'
import DataTable from '@/components/ui/DataTable'
import FilterMultiSelect from '@/components/filters/FilterMultiSelect'
import YearRangeFilter from '@/components/filters/YearRangeFilter'
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
  const coords         = useCrossingsStore((s) => s.coords)
  const yearsAvailable = useCrossingsStore((s) => s.yearsAvailable)
  const minYear        = useCrossingsStore((s) => s.minYear)
  const maxYear        = useCrossingsStore((s) => s.maxYear)

  const [searchParams, setSearchParams] = useSearchParams()

  /* ── Parse filters from URL ──────────────────────────────────────── */
  const parsedYearRange = parseYearRangeParam(searchParams.get('year'), { minYear, maxYear })
  const startYear = parsedYearRange?.start ?? (minYear ?? 2008)
  const endYear   = parsedYearRange?.end   ?? (maxYear ?? 2025)
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

  const handleYearRangeChange = useCallback(({ startYear: s, endYear: e }) => {
    const isFullRange = s === minYear && e === maxYear
    updateParams({ year: isFullRange ? null : `${s}-${e}` })
  }, [updateParams, minYear, maxYear])

  const handleRegionChange = useCallback((vals) => {
    updateParams({ region: vals })
  }, [updateParams])

  const handleCrossingChange = useCallback((vals) => {
    updateParams({ crossing: vals })
  }, [updateParams])

  const handleResetAll = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setSearchParams])

  /* ── Canonical crossing options (north-to-south) ─────────────────── */
  const crossingOptions = useMemo(() => {
    if (!yearly?.length) return []
    const uniq = new Set()
    for (const r of yearly) if (r.Crossing) uniq.add(r.Crossing)
    const cmp = makeCrossingOrderComparator(coords)
    return [...uniq].sort(cmp)
  }, [yearly, coords])

  /* ── Filtered rows ───────────────────────────────────────────────── */
  const filters = useMemo(() => ({
    yearRange: { start: startYear, end: endYear },
    regions: selectedRegions,
    crossings: selectedCrossings,
  }), [startYear, endYear, selectedRegions, selectedCrossings])

  const filteredRows = useMemo(
    () => (yearly?.length ? filterRows(yearly, filters) : []),
    [yearly, filters],
  )

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

  /* ── Mode totals table (Mode, Northbound Crossings, Share %) ─────── */
  const modeTotals = useMemo(() => {
    const totals = new Map()
    for (const r of filteredRows) {
      if (!r.Modes) continue
      totals.set(r.Modes, (totals.get(r.Modes) || 0) + (r['Northbound Crossing'] || 0))
    }
    const grand = [...totals.values()].reduce((s, v) => s + v, 0)
    return MODES
      .filter((m) => totals.has(m))
      .map((m) => {
        const value = totals.get(m)
        return {
          Mode: m,
          value,
          valueFormatted: formatNumber(value),
          share: grand > 0 ? value / grand : 0,
          shareFormatted: grand > 0 ? formatPercent(value / grand) : '—',
        }
      })
  }, [filteredRows])

  /* ── Shared helpers for sidebar tags & active count ──────────────── */
  const isYearDefault = (minYear == null || maxYear == null)
    ? true
    : (startYear === minYear && endYear === maxYear)

  const activeCount =
    (isYearDefault ? 0 : 1) +
    (selectedRegions.length > 0 ? 1 : 0) +
    (selectedCrossings.length > 0 ? 1 : 0)

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
    return tags
  }, [isYearDefault, startYear, endYear, selectedRegions, selectedCrossings, updateParams, handleRegionChange, handleCrossingChange])

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
    <>
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

      <FilterMultiSelect
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
        options={crossingOptions}
        onChange={handleCrossingChange}
        allLabel="All crossings"
        searchable
      />
    </>
  )

  /* ── Page-level CSV download (filtered yearly rows) ──────────────── */
  const pageDownload = filteredRows.length > 0
    ? {
        data: filteredRows,
        filename: `cbp-by-mode-${startYear}-${endYear}`,
        columns: PAGE_YEARLY_COLS,
      }
    : undefined

  /* ── Hero ────────────────────────────────────────────────────────── */
  const hero = (
    <div className="gradient-blue text-white relative overflow-visible">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative py-8 md:py-10">
        <h2 className="text-2xl md:text-3xl font-bold text-white text-balance">
          Northbound Crossings by Mode ({startYear}–{endYear})
        </h2>
        <p className="text-white/80 mt-2 text-sm md:text-base leading-relaxed max-w-3xl">
          How each of the five CBP-reported modes — trucks, buses, pedestrians/bicyclists,
          passenger vehicles, and railcars — has moved across the Texas–Mexico border over time.
          Narrow the view by region, crossing, or year range using the sidebar.
        </p>
      </div>
    </div>
  )

  /* ── Year-range subtitle for charts ──────────────────────────────── */
  const yearSubtitle = `Texas–Mexico northbound, ${startYear}–${endYear}`

  /* ── Table columns ───────────────────────────────────────────────── */
  const tableColumns = [
    {
      key: 'Mode',
      label: 'Mode',
      render: (_v, row) => (
        <span className="inline-flex items-center gap-2">
          <ModeIcon
            mode={row.Mode}
            size={18}
            className="text-brand-blue"
          />
          <span>{row.Mode}</span>
        </span>
      ),
    },
    {
      key: 'value',
      label: 'Northbound Crossings',
      render: (_v, row) => row.valueFormatted,
    },
    {
      key: 'share',
      label: 'Share (%)',
      render: (_v, row) => row.shareFormatted,
    },
  ]

  const tableDownloadData = modeTotals.map((r) => ({
    Mode: r.Mode,
    'Northbound Crossings': r.value,
    'Share (%)': Number((r.share * 100).toFixed(2)),
  }))

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
            title="Northbound Crossings by Mode"
            subtitle={yearSubtitle}
            downloadData={{
              summary: {
                data: stackedData,
                filename: `mode-by-year-${startYear}-${endYear}`,
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

      {/* ── Line chart — one line per mode ──────────────────────────── */}
      <SectionBlock alt>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5 mb-5">
            <LineIcon size={20} className="text-brand-blue" />
            <h3 className="text-xl font-bold text-text-primary">Mode trends over time</h3>
          </div>
          <ChartCard
            title="Mode Trends"
            subtitle={yearSubtitle}
            downloadData={{
              summary: {
                data: lineData,
                filename: `mode-trends-${startYear}-${endYear}`,
                columns: DL.crossingsTrendSeries,
              },
            }}
            emptyState={
              lineData.length === 0
                ? 'No crossings match the current filters.'
                : undefined
            }
          >
            <LineChart
              data={lineData}
              xKey="year"
              yKey="value"
              seriesKey="Mode"
              formatValue={formatCompact}
              colorOverrides={MODE_COLOR_OVERRIDES}
            />
          </ChartCard>
        </div>
      </SectionBlock>

      {/* ── Mode totals table ──────────────────────────────────────── */}
      <SectionBlock>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5 mb-5">
            <TableIcon size={20} className="text-brand-blue" />
            <h3 className="text-xl font-bold text-text-primary">Mode totals &amp; share</h3>
          </div>
          <ChartCard
            title={`Mode Totals (${startYear}–${endYear})`}
            subtitle="Totals across the selected regions and crossings; shares sum to 100% within the current filter."
            minHeight={0}
            downloadData={{
              summary: {
                data: tableDownloadData,
                filename: `mode-totals-${startYear}-${endYear}`,
                columns: {
                  Mode: 'Mode',
                  'Northbound Crossings': 'Northbound Crossings',
                  'Share (%)': 'Share (%)',
                },
              },
            }}
            emptyState={
              modeTotals.length === 0
                ? 'No crossings match the current filters.'
                : undefined
            }
          >
            <DataTable
              columns={tableColumns}
              data={modeTotals}
              pageSize={MODES.length}
              fullWidth
            />
          </ChartCard>
        </div>
      </SectionBlock>
    </DashboardLayout>
  )
}
