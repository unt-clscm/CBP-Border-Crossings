/**
 * cbpHelpers.js — Aggregation + selector helpers for CBP northbound
 * border-crossing data.
 *
 * Input rows have the shape:
 *   { Year, Month?, Region, POE, Crossing, Modes, 'Northbound Crossing' }
 *
 * All helpers are pure: they accept rows + options and return a new array,
 * never mutating inputs.
 */

export const MODES = [
  'Commercial Trucks',
  'Buses',
  'Pedestrians/ Bicyclists',
  'Passenger Vehicles',
  'Railcars',
]

export const REGIONS = ['El Paso', 'Laredo', 'Rio Grande Valley']

/** Pretty labels for legend/axis display (mode values are stored as-is). */
export const MODE_LABELS = {
  'Commercial Trucks': 'Trucks',
  'Buses': 'Buses',
  'Pedestrians/ Bicyclists': 'Pedestrians',
  'Passenger Vehicles': 'POVs',
  'Railcars': 'Railcars',
}

const VALUE_KEY = 'Northbound Crossing'

function sum(rows) {
  let total = 0
  for (const r of rows) total += r[VALUE_KEY] || 0
  return total
}

/** Generic filter used across pages. All selectors are optional. */
export function filterRows(rows, {
  year = null,
  yearRange = null,      // { start, end }
  modes = null,          // string[] — empty or null == all
  regions = null,
  crossings = null,
  month = null,
} = {}) {
  if (!rows?.length) return []
  return rows.filter((r) => {
    if (year != null && r.Year !== year) return false
    if (yearRange) {
      const { start, end } = yearRange
      if (start != null && r.Year < start) return false
      if (end != null && r.Year > end) return false
    }
    if (month != null && r.Month !== month) return false
    if (modes?.length && !modes.includes(r.Modes)) return false
    if (regions?.length && !regions.includes(r.Region)) return false
    if (crossings?.length && !crossings.includes(r.Crossing)) return false
    return true
  })
}

/** Total volume. */
export function totalCrossings(rows) {
  return sum(rows)
}

/** YoY delta for the latest year vs the prior year, given yearly rows. */
export function yoyDelta(yearlyRows, latestYear) {
  if (!latestYear) return { latest: 0, prior: 0, delta: 0, pct: null }
  const latest = sum(yearlyRows.filter((r) => r.Year === latestYear))
  const prior  = sum(yearlyRows.filter((r) => r.Year === latestYear - 1))
  const delta = latest - prior
  const pct = prior ? (delta / prior) : null
  return { latest, prior, delta, pct }
}

/** Donut-ready: mode share for a given year. */
export function modeMix(yearlyRows, year) {
  const rows = year != null ? yearlyRows.filter((r) => r.Year === year) : yearlyRows
  const map = new Map()
  for (const r of rows) {
    if (!r.Modes) continue
    map.set(r.Modes, (map.get(r.Modes) || 0) + (r[VALUE_KEY] || 0))
  }
  // Preserve canonical MODES order; drop zero entries.
  return MODES
    .filter((m) => map.has(m) && map.get(m) > 0)
    .map((m) => ({ label: m, value: map.get(m) }))
}

/**
 * BarChart-ready: top-N crossings by total volume across all modes for a year.
 * Returns [{ label, value }].
 */
export function topCrossings(yearlyRows, year, n = 5) {
  const rows = year != null ? yearlyRows.filter((r) => r.Year === year) : yearlyRows
  const map = new Map()
  for (const r of rows) {
    if (!r.Crossing) continue
    map.set(r.Crossing, (map.get(r.Crossing) || 0) + (r[VALUE_KEY] || 0))
  }
  return Array.from(map, ([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n)
}

/**
 * Time series of a single crossing × modes. Wide-format output suitable for
 * LineChart or StackedBarChart (one row per period, one column per mode).
 *
 * @param rows — monthly or yearly rows (already filtered to one crossing).
 * @param granularity — 'year' or 'month'
 */
export function crossingSeries(rows, { granularity = 'year' } = {}) {
  if (!rows?.length) return { data: [], keys: [] }
  const keys = new Set()
  const byPeriod = new Map()
  const periodKey = (r) => granularity === 'month' ? `${r.Year}-${String(r.Month).padStart(2, '0')}` : String(r.Year)

  for (const r of rows) {
    keys.add(r.Modes)
    const key = periodKey(r)
    if (!byPeriod.has(key)) {
      byPeriod.set(key, granularity === 'month'
        ? { period: key, Year: r.Year, Month: r.Month }
        : { period: key, Year: r.Year })
    }
    byPeriod.get(key)[r.Modes] = (byPeriod.get(key)[r.Modes] || 0) + (r[VALUE_KEY] || 0)
  }

  const orderedKeys = MODES.filter((m) => keys.has(m))
  // Zero-fill missing keys so stacked charts work.
  const data = Array.from(byPeriod.values()).sort((a, b) => a.period.localeCompare(b.period))
  for (const row of data) for (const k of orderedKeys) if (!(k in row)) row[k] = 0
  return { data, keys: orderedKeys }
}

/**
 * Wide-format year × mode series across *all* crossings in the input rows.
 * Used by ByMode and ByRegion pages.
 */
export function yearlyModeSeries(yearlyRows) {
  if (!yearlyRows?.length) return { data: [], keys: [] }
  const keys = new Set()
  const byYear = new Map()
  for (const r of yearlyRows) {
    if (r.Year == null || !r.Modes) continue
    keys.add(r.Modes)
    if (!byYear.has(r.Year)) byYear.set(r.Year, { year: r.Year })
    byYear.get(r.Year)[r.Modes] = (byYear.get(r.Year)[r.Modes] || 0) + (r[VALUE_KEY] || 0)
  }
  const orderedKeys = MODES.filter((m) => keys.has(m))
  const data = Array.from(byYear.values()).sort((a, b) => a.year - b.year)
  for (const row of data) for (const k of orderedKeys) if (!(k in row)) row[k] = 0
  return { data, keys: orderedKeys }
}

/**
 * Wide-format year × region series. Stacks sum to per-year totals across the
 * three CBP field-office regions. Rows with unknown Region are skipped.
 */
export function yearlyRegionSeries(yearlyRows) {
  if (!yearlyRows?.length) return { data: [], keys: [] }
  const byYear = new Map()
  for (const r of yearlyRows) {
    if (r.Year == null || !REGIONS.includes(r.Region)) continue
    if (!byYear.has(r.Year)) byYear.set(r.Year, { year: r.Year })
    const row = byYear.get(r.Year)
    row[r.Region] = (row[r.Region] || 0) + (r[VALUE_KEY] || 0)
  }
  const data = Array.from(byYear.values()).sort((a, b) => a.year - b.year)
  for (const row of data) for (const k of REGIONS) if (!(k in row)) row[k] = 0
  return { data, keys: REGIONS }
}

/** Unique sorted list of crossings observed in rows. */
export function distinctCrossings(rows) {
  const s = new Set()
  for (const r of rows) if (r.Crossing) s.add(r.Crossing)
  return [...s].sort()
}

/**
 * Canonical north-to-south crossing order from the coordinates file.
 * Returns a comparator that sorts by the coordinate `order` field.
 */
export function makeCrossingOrderComparator(coords) {
  const rank = new Map()
  for (const c of coords || []) {
    const key = c.data_crossing_name || c.crossing_name
    if (!rank.has(key)) rank.set(key, c.order ?? 999)
  }
  return (a, b) => {
    const ra = rank.has(a) ? rank.get(a) : 999
    const rb = rank.has(b) ? rank.get(b) : 999
    if (ra !== rb) return ra - rb
    return String(a).localeCompare(String(b))
  }
}

/** Canonical region order (north-to-south). */
export function sortRegions(regions) {
  const order = new Map(REGIONS.map((r, i) => [r, i]))
  return [...regions].sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99))
}

/**
 * Parse a year-range URL param accepting either "YYYY" or "YYYY-YYYY".
 *
 * Returns `{ start, end }` (inclusive, clamped to [minYear, maxYear] when
 * provided) or `null` if `param` is empty, malformed, or cannot be parsed.
 * Both forms are canonical across the three filtered pages so users never
 * see inconsistent URL behaviour.
 */
export function parseYearRangeParam(param, { minYear = null, maxYear = null } = {}) {
  if (param == null) return null
  const raw = String(param).trim()
  if (!raw) return null

  const single = raw.match(/^(\d{4})$/)
  const range  = raw.match(/^(\d{4})-(\d{4})$/)

  let start
  let end
  if (single) {
    start = Number(single[1])
    end   = start
  } else if (range) {
    start = Number(range[1])
    end   = Number(range[2])
  } else {
    return null
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  if (start > end) [start, end] = [end, start]

  if (Number.isFinite(minYear)) {
    start = Math.max(minYear, start)
    end   = Math.max(minYear, end)
  }
  if (Number.isFinite(maxYear)) {
    start = Math.min(maxYear, start)
    end   = Math.min(maxYear, end)
  }
  if (start > end) [start, end] = [end, start]
  return { start, end }
}

export { VALUE_KEY }
