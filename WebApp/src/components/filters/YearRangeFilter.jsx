/**
 * YearRangeFilter — Compact year range selector for trend charts.
 * Sits in ChartCard's headerRight slot.
 *
 * Props:
 *   @param {number[]} years — sorted array of available years
 *   @param {number} startYear — currently selected start
 *   @param {number} endYear — currently selected end
 *   @param {function} onChange — called with { startYear, endYear }
 */
import SelectChevron from './SelectChevron'

export default function YearRangeFilter({ years = [], startYear, endYear, onChange }) {
  if (years.length < 2) return null

  const handleStart = (e) => {
    const val = Number(e.target.value)
    onChange({ startYear: val, endYear: Math.max(val, endYear) })
  }

  const handleEnd = (e) => {
    const val = Number(e.target.value)
    onChange({ startYear: Math.min(startYear, val), endYear: val })
  }

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <div className="relative">
        <select
          value={startYear}
          onChange={handleStart}
          className="appearance-none px-2 py-1 pr-6 rounded border border-border bg-white text-text-primary
                     text-sm focus:outline-none focus:ring-1 focus:ring-brand-blue/30 cursor-pointer"
          aria-label="Start year"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <SelectChevron />
      </div>
      <span className="text-text-secondary">&ndash;</span>
      <div className="relative">
        <select
          value={endYear}
          onChange={handleEnd}
          className="appearance-none px-2 py-1 pr-6 rounded border border-border bg-white text-text-primary
                     text-sm focus:outline-none focus:ring-1 focus:ring-brand-blue/30 cursor-pointer"
          aria-label="End year"
        >
          {years.filter((y) => y >= startYear).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <SelectChevron />
      </div>
    </div>
  )
}
