/**
 * Central Zustand store for CBP northbound border-crossing data.
 *
 * Loads three static JSON files at init (all small enough to ship in one
 * bundle — no lazy loading needed):
 *   - monthly_crossings_2008_2025.json  (~34 K rows)
 *   - yearly_crossings_2008_2025.json   (~2.8 K rows)
 *   - crossings_coordinates.json        (34 rows)
 *
 * Uses the same AbortSignal/timeout pattern as the sibling BTS TransBorder app
 * to make slow networks fail visibly.
 */
import { create } from 'zustand'

const base = import.meta.env.BASE_URL

const DATASET_FILES = {
  monthly: 'monthly_crossings_2008_2025.json',
  yearly: 'yearly_crossings_2008_2025.json',
  coords: 'crossings_coordinates.json',
}

const FETCH_TIMEOUT_MS = 30_000

// Display window: only the last N years (inclusive of latest) are surfaced to the UI.
// Raw JSON still covers 2008–2025; older rows are filtered out at load time.
const YEARS_WINDOW = 10

const NUMERIC_FIELDS = ['Year', 'Month', 'Northbound Crossing']
const STRING_FIELDS = ['ID', 'Region', 'POE', 'Crossing', 'Modes']

function normalizeRow(d) {
  const out = { ...d }
  for (const key of NUMERIC_FIELDS) {
    if (key in out) {
      const v = out[key]
      const num = +v
      out[key] = v === null || v === '' || !Number.isFinite(num) ? null : num
    }
  }
  for (const key of STRING_FIELDS) {
    if (typeof out[key] === 'string') {
      out[key] = out[key].trim() || null
    }
  }
  return out
}

function applyYearWindow(rows) {
  let maxYear = -Infinity
  for (const r of rows) {
    if (Number.isFinite(r.Year) && r.Year > maxYear) maxYear = r.Year
  }
  if (!Number.isFinite(maxYear)) return rows
  const cutoff = maxYear - YEARS_WINDOW + 1
  return rows.filter((r) => Number.isFinite(r.Year) && r.Year >= cutoff)
}

function fetchWithTimeout(url, signal) {
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  const combined = AbortSignal.any ? AbortSignal.any([signal, timeout]) : signal
  return fetch(url, { signal: combined }).catch((err) => {
    if (err.name === 'TimeoutError') {
      throw new Error('Request timed out — the server took too long to respond. Please try again.')
    }
    throw err
  })
}

const abortControllers = {}

function getOrReplaceController(key) {
  if (abortControllers[key]) {
    abortControllers[key].abort()
  }
  const controller = new AbortController()
  abortControllers[key] = controller
  return controller
}

/**
 * Build lookup indexes over rows. `rows` is either monthly or yearly data.
 * Returned shape:
 *   { byCrossing: Map<crossing, row[]>, byRegion: Map<region, row[]>, years: number[] }
 */
export function buildIndexes(rows) {
  const byCrossing = new Map()
  const byRegion = new Map()
  const yearSet = new Set()
  for (const r of rows) {
    if (r.Crossing) {
      if (!byCrossing.has(r.Crossing)) byCrossing.set(r.Crossing, [])
      byCrossing.get(r.Crossing).push(r)
    }
    if (r.Region) {
      if (!byRegion.has(r.Region)) byRegion.set(r.Region, [])
      byRegion.get(r.Region).push(r)
    }
    if (Number.isFinite(r.Year)) yearSet.add(r.Year)
  }
  const years = [...yearSet].sort((a, b) => a - b)
  return { byCrossing, byRegion, years }
}

async function fetchJson(file, signalKey) {
  const controller = getOrReplaceController(signalKey)
  const resp = await fetchWithTimeout(`${base}data/${file}`, controller.signal)
  if (!resp.ok) throw new Error(`Failed to load ${file}: ${resp.status}`)
  return resp.json()
}

export const useCrossingsStore = create((set) => ({
  status: 'idle',
  error: null,

  // Monthly loads in the background after the app is usable — track separately.
  monthlyStatus: 'idle',
  monthlyError: null,

  monthly: [],
  yearly: [],
  coords: [],

  byCrossingMonthly: new Map(),
  byCrossingYearly: new Map(),
  byRegionMonthly: new Map(),
  byRegionYearly: new Map(),
  // Plan-contract aliases — point at the yearly indexes.
  byCrossing: new Map(),
  byRegion: new Map(),

  yearsAvailable: [],
  maxYear: null,
  minYear: null,

  init: async () => {
    set({ status: 'loading', error: null, monthlyStatus: 'loading', monthlyError: null })

    // Monthly is a 7–8 MB payload that no shipped page currently consumes.
    // Fire it in parallel but do NOT let its failure block app-ready state.
    const monthlyPromise = fetchJson(DATASET_FILES.monthly, 'monthly')
      .then((raw) => {
        const monthly = applyYearWindow(raw.map(normalizeRow))
        const ix = buildIndexes(monthly)
        set({
          monthly,
          byCrossingMonthly: ix.byCrossing,
          byRegionMonthly: ix.byRegion,
          monthlyStatus: 'ready',
        })
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        console.warn('Monthly dataset failed to load (app continues without it):', err)
        set({ monthlyStatus: 'error', monthlyError: err.message })
      })

    try {
      const [yearlyRaw, coordsRaw] = await Promise.all([
        fetchJson(DATASET_FILES.yearly, 'yearly'),
        fetchJson(DATASET_FILES.coords, 'coords'),
      ])

      const yearly = applyYearWindow(yearlyRaw.map(normalizeRow))
      const yearlyIx = buildIndexes(yearly)

      const yearsAvailable = yearlyIx.years
      const maxYear = yearsAvailable.length ? yearsAvailable[yearsAvailable.length - 1] : null
      const minYear = yearsAvailable.length ? yearsAvailable[0] : null

      set({
        status: 'ready',
        yearly,
        coords: coordsRaw,
        byCrossingYearly: yearlyIx.byCrossing,
        byRegionYearly: yearlyIx.byRegion,
        byCrossing: yearlyIx.byCrossing,
        byRegion: yearlyIx.byRegion,
        yearsAvailable,
        maxYear,
        minYear,
      })
    } catch (err) {
      if (err.name === 'AbortError') return
      console.error('Failed to load CBP crossings data:', err)
      set({ status: 'error', error: err.message })
    }

    // Keep the reference so tests/callers can await full settle if needed.
    return monthlyPromise
  },
}))
