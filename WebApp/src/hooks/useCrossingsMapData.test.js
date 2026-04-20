import { describe, it, expect } from 'vitest'
import { buildMapCrossings, aggregateByDataCrossing } from './useCrossingsMapData'

const coords = [
  { order: 3, crossing_name: 'Bridge of the Americas', data_crossing_name: 'Bridge of the Americas', region: 'El Paso', port_of_entry: 'El Paso', code: 'ELP-ELP-BRID', lat: 31.76, lon: -106.45 },
  { order: 4, crossing_name: 'BNSF Railroad Rail Bridge', data_crossing_name: 'El Paso Railroad Bridges', region: 'El Paso', port_of_entry: 'El Paso', code: 'ELP-ELP-ELPA-BNSF', lat: 31.75, lon: -106.49 },
  { order: 5, crossing_name: 'Union Pacific Railroad Rail Bridge', data_crossing_name: 'El Paso Railroad Bridges', region: 'El Paso', port_of_entry: 'El Paso', code: 'ELP-ELP-ELPA-UP', lat: 31.75, lon: -106.48 },
]

describe('aggregateByDataCrossing', () => {
  it('sums values by Crossing for a given year', () => {
    const rows = [
      { Year: 2024, Crossing: 'Bridge of the Americas', 'Northbound Crossing': 100 },
      { Year: 2024, Crossing: 'Bridge of the Americas', 'Northbound Crossing': 50 },
      { Year: 2024, Crossing: 'El Paso Railroad Bridges', 'Northbound Crossing': 20 },
      { Year: 2023, Crossing: 'Bridge of the Americas', 'Northbound Crossing': 999 },
    ]
    const map = aggregateByDataCrossing(rows, { year: 2024 })
    expect(map.get('Bridge of the Americas')).toBe(150)
    expect(map.get('El Paso Railroad Bridges')).toBe(20)
  })
})

describe('buildMapCrossings', () => {
  it('emits one marker per coordinate row — two El Paso rail pins share one value', () => {
    const values = new Map([
      ['Bridge of the Americas', 150],
      ['El Paso Railroad Bridges', 20],
    ])
    const markers = buildMapCrossings(coords, values)
    expect(markers).toHaveLength(3)
    const bnsf = markers.find((m) => m.crossingName === 'BNSF Railroad Rail Bridge')
    const up = markers.find((m) => m.crossingName === 'Union Pacific Railroad Rail Bridge')
    expect(bnsf.value).toBe(20)
    expect(up.value).toBe(20)
    expect(bnsf.isRail && up.isRail).toBe(true)
  })

  it('falls back to zero when no data is available for a crossing', () => {
    const markers = buildMapCrossings(coords, new Map())
    expect(markers.every((m) => m.value === 0)).toBe(true)
  })
})
