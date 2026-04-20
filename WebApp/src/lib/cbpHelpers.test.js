import { describe, it, expect } from 'vitest'
import {
  filterRows, totalCrossings, yoyDelta, modeMix, topCrossings,
  crossingSeries, yearlyModeSeries, makeCrossingOrderComparator, sortRegions,
  parseYearRangeParam,
} from './cbpHelpers'

const yearly = [
  { Year: 2024, Region: 'El Paso', POE: 'El Paso', Crossing: 'Bridge of the Americas', Modes: 'Commercial Trucks', 'Northbound Crossing': 100 },
  { Year: 2024, Region: 'El Paso', POE: 'El Paso', Crossing: 'Bridge of the Americas', Modes: 'Passenger Vehicles', 'Northbound Crossing': 200 },
  { Year: 2024, Region: 'Laredo',  POE: 'Laredo',  Crossing: 'World Trade Bridge',      Modes: 'Commercial Trucks', 'Northbound Crossing': 500 },
  { Year: 2024, Region: 'Rio Grande Valley', POE: 'Hidalgo', Crossing: 'Pharr International Bridge', Modes: 'Commercial Trucks', 'Northbound Crossing': 300 },
  { Year: 2023, Region: 'El Paso', POE: 'El Paso', Crossing: 'Bridge of the Americas', Modes: 'Commercial Trucks', 'Northbound Crossing': 90 },
  { Year: 2023, Region: 'Laredo',  POE: 'Laredo',  Crossing: 'World Trade Bridge',      Modes: 'Commercial Trucks', 'Northbound Crossing': 450 },
]

describe('filterRows', () => {
  it('returns empty array for empty input', () => {
    expect(filterRows([], { year: 2024 })).toEqual([])
  })
  it('filters by single year', () => {
    expect(filterRows(yearly, { year: 2024 })).toHaveLength(4)
  })
  it('filters by year range (inclusive)', () => {
    expect(filterRows(yearly, { yearRange: { start: 2024, end: 2024 } })).toHaveLength(4)
    expect(filterRows(yearly, { yearRange: { start: 2023, end: 2024 } })).toHaveLength(6)
  })
  it('filters by modes (empty array == all)', () => {
    expect(filterRows(yearly, { modes: ['Commercial Trucks'] })).toHaveLength(5)
    expect(filterRows(yearly, { modes: [] })).toHaveLength(6)
  })
  it('combines filters (AND semantics)', () => {
    const out = filterRows(yearly, { year: 2024, regions: ['El Paso'] })
    expect(out).toHaveLength(2)
    expect(out.every((r) => r.Region === 'El Paso' && r.Year === 2024)).toBe(true)
  })
})

describe('totalCrossings', () => {
  it('sums the "Northbound Crossing" field', () => {
    expect(totalCrossings(filterRows(yearly, { year: 2024 }))).toBe(1100)
  })
})

describe('yoyDelta', () => {
  it('returns latest, prior, delta, pct', () => {
    const r = yoyDelta(yearly, 2024)
    expect(r.latest).toBe(1100)
    expect(r.prior).toBe(540)
    expect(r.delta).toBe(560)
    expect(r.pct).toBeCloseTo(560 / 540, 5)
  })
  it('returns null pct when prior is zero', () => {
    const r = yoyDelta(filterRows(yearly, { year: 2024 }), 2024)
    expect(r.prior).toBe(0)
    expect(r.pct).toBeNull()
  })
})

describe('modeMix', () => {
  it('returns canonical mode order with non-zero values', () => {
    const mix = modeMix(yearly, 2024)
    const labels = mix.map((m) => m.label)
    // MODES order is Commercial Trucks, Buses, Pedestrians, Passenger Vehicles, Railcars
    expect(labels).toEqual(['Commercial Trucks', 'Passenger Vehicles'])
  })
})

describe('topCrossings', () => {
  it('returns top-N sorted descending', () => {
    const top = topCrossings(yearly, 2024, 2)
    expect(top).toEqual([
      { label: 'World Trade Bridge', value: 500 },
      { label: 'Bridge of the Americas', value: 300 },
    ])
  })
})

describe('crossingSeries', () => {
  it('wide-formats a crossing time series with zero-fill', () => {
    const rows = yearly.filter((r) => r.Crossing === 'Bridge of the Americas')
    const { data, keys } = crossingSeries(rows, { granularity: 'year' })
    expect(keys).toEqual(['Commercial Trucks', 'Passenger Vehicles'])
    // 2023 has no Passenger Vehicles row — must still be present as 0.
    const y2023 = data.find((d) => d.Year === 2023)
    expect(y2023['Passenger Vehicles']).toBe(0)
    expect(y2023['Commercial Trucks']).toBe(90)
  })
})

describe('yearlyModeSeries', () => {
  it('returns wide-format year × mode data with canonical keys', () => {
    const { data, keys } = yearlyModeSeries(yearly)
    expect(keys).toEqual(['Commercial Trucks', 'Passenger Vehicles'])
    expect(data).toHaveLength(2)
    expect(data[0].year).toBe(2023)
    expect(data[1].year).toBe(2024)
  })
})

describe('makeCrossingOrderComparator', () => {
  it('sorts by coordinates `order` field, falling back to name', () => {
    const coords = [
      { order: 3, data_crossing_name: 'Bridge of the Americas' },
      { order: 18, data_crossing_name: 'World Trade Bridge' },
      { order: 27, data_crossing_name: 'Pharr International Bridge' },
    ]
    const cmp = makeCrossingOrderComparator(coords)
    const sorted = ['World Trade Bridge', 'Pharr International Bridge', 'Bridge of the Americas'].sort(cmp)
    expect(sorted).toEqual(['Bridge of the Americas', 'World Trade Bridge', 'Pharr International Bridge'])
  })
})

describe('sortRegions', () => {
  it('sorts El Paso, Laredo, Rio Grande Valley north-to-south', () => {
    expect(sortRegions(['Rio Grande Valley', 'El Paso', 'Laredo']))
      .toEqual(['El Paso', 'Laredo', 'Rio Grande Valley'])
  })
})

describe('parseYearRangeParam', () => {
  const bounds = { minYear: 2008, maxYear: 2025 }

  it('parses a single year "2020" → { start: 2020, end: 2020 }', () => {
    expect(parseYearRangeParam('2020', bounds)).toEqual({ start: 2020, end: 2020 })
  })
  it('parses a year range "2020-2024" → inclusive { start, end }', () => {
    expect(parseYearRangeParam('2020-2024', bounds)).toEqual({ start: 2020, end: 2024 })
  })
  it('returns null for malformed input', () => {
    expect(parseYearRangeParam('not-a-year', bounds)).toBeNull()
    expect(parseYearRangeParam('2020-', bounds)).toBeNull()
    expect(parseYearRangeParam('20-24', bounds)).toBeNull()
  })
  it('returns null for empty / nullish input', () => {
    expect(parseYearRangeParam('', bounds)).toBeNull()
    expect(parseYearRangeParam(null, bounds)).toBeNull()
    expect(parseYearRangeParam(undefined, bounds)).toBeNull()
    expect(parseYearRangeParam('   ', bounds)).toBeNull()
  })
  it('clamps to min/max bounds when provided', () => {
    expect(parseYearRangeParam('1999-2030', bounds)).toEqual({ start: 2008, end: 2025 })
  })
  it('swaps inverted ranges', () => {
    expect(parseYearRangeParam('2024-2020', bounds)).toEqual({ start: 2020, end: 2024 })
  })
})
