import { describe, it, expect } from 'vitest'
import { buildIndexes } from './crossingsStore'

const sample = [
  { Year: 2024, Region: 'El Paso',  Crossing: 'BOTA',      Modes: 'Commercial Trucks', 'Northbound Crossing': 10 },
  { Year: 2024, Region: 'El Paso',  Crossing: 'BOTA',      Modes: 'Passenger Vehicles', 'Northbound Crossing': 20 },
  { Year: 2024, Region: 'Laredo',   Crossing: 'World Trade', Modes: 'Commercial Trucks', 'Northbound Crossing': 30 },
  { Year: 2023, Region: 'Laredo',   Crossing: 'World Trade', Modes: 'Commercial Trucks', 'Northbound Crossing': 25 },
  { Year: null, Region: null,       Crossing: null,        Modes: null, 'Northbound Crossing': 0 },
]

describe('buildIndexes', () => {
  it('groups rows by Crossing and by Region, skipping nulls', () => {
    const { byCrossing, byRegion, years } = buildIndexes(sample)
    expect(byCrossing.get('BOTA')).toHaveLength(2)
    expect(byCrossing.get('World Trade')).toHaveLength(2)
    expect(byCrossing.has(null)).toBe(false)

    expect(byRegion.get('El Paso')).toHaveLength(2)
    expect(byRegion.get('Laredo')).toHaveLength(2)
    expect(byRegion.has(null)).toBe(false)
  })

  it('returns sorted unique years', () => {
    const { years } = buildIndexes(sample)
    expect(years).toEqual([2023, 2024])
  })

  it('handles empty input without throwing', () => {
    const { byCrossing, byRegion, years } = buildIndexes([])
    expect(byCrossing.size).toBe(0)
    expect(byRegion.size).toBe(0)
    expect(years).toEqual([])
  })
})
