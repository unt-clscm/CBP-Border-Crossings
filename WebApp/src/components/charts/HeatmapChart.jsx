/**
 * HeatmapChart — Row × column grid colored by cell value.
 *
 * Shares are rescaled PER ROW onto each row's own observed [min, max] span,
 * so a row where every month is close to 1/12 still shows a visible
 * low→high gradient. This means color intensity compares *within* a row, not
 * across rows — the legend calls that out explicitly.
 *
 * Props
 *   @param {Array<{ rowLabel: string, cells: Array<{ colKey: any, value: number, share: number }> }>} rows
 *   @param {Array<{ key: any, label: string }>} columns
 *   @param {Function} [formatValue]
 *   @param {[string, string]} [colorRange] — [low, high] hex endpoints. Default uses
 *     a warm→cool diverging palette (amber → deep blue) so small share differences
 *     read clearly.
 *   @param {Function} [renderRowLabel]
 */
import { useMemo } from 'react'
import * as d3 from 'd3'
import { formatCompact } from '@/lib/chartColors'

const DEFAULT_RANGE = ['#fef3c7', '#b45309', '#0056a9']

// WCAG-compliant text color picker: chooses white or near-black based on
// whichever yields the higher contrast ratio against the given background.
const DARK_TEXT = '#111827' // gray-900
const LIGHT_TEXT = '#ffffff'
const toLinear = (v) => {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}
const relativeLuminance = (r, g, b) =>
  0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
// Precompute luminance for DARK_TEXT (#111827 → ~0.0116)
const DARK_TEXT_L = relativeLuminance(17, 24, 39)
function pickTextColor(bg) {
  const c = d3.color(bg)
  if (!c) return DARK_TEXT
  const { r, g, b } = c.rgb()
  const L = relativeLuminance(r, g, b)
  const contrastWhite = 1.05 / (L + 0.05)
  const contrastDark = (L + 0.05) / (DARK_TEXT_L + 0.05)
  return contrastWhite >= contrastDark ? LIGHT_TEXT : DARK_TEXT
}

export default function HeatmapChart({
  rows = [],
  columns = [],
  formatValue = formatCompact,
  colorRange = DEFAULT_RANGE,
  renderRowLabel,
}) {
  // Global scale only used as a fallback / for the legend swatch.
  const legendScale = useMemo(() => {
    const domain = colorRange.map((_, i) => i / (colorRange.length - 1))
    return d3.scaleLinear().domain(domain).range(colorRange).clamp(true)
  }, [colorRange])

  // Per-row min/max so within-row variation is always visible, even when
  // shares cluster near 1/N.
  const rowScales = useMemo(() => {
    const m = new Map()
    for (const row of rows) {
      let min = Infinity
      let max = -Infinity
      for (const c of row.cells) {
        if (c.share < min) min = c.share
        if (c.share > max) max = c.share
      }
      const domain = [min, max]
      // Guard against a flat row (all cells equal) — fall back to mid-range color.
      if (!isFinite(min) || min === max) {
        m.set(row.rowLabel, () => colorRange[Math.floor(colorRange.length / 2)])
      } else {
        const stops = colorRange.length
        const scaleDomain = []
        for (let i = 0; i < stops; i++) {
          scaleDomain.push(min + ((max - min) * i) / (stops - 1))
        }
        m.set(
          row.rowLabel,
          d3.scaleLinear().domain(scaleDomain).range(colorRange).clamp(true),
        )
      }
    }
    return m
  }, [rows, colorRange])

  if (!rows.length || !columns.length) {
    return (
      <div className="flex items-center justify-center h-48 text-text-secondary italic text-base">
        No data to display.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-y-1 min-w-[760px] text-sm"
        style={{ gridTemplateColumns: `minmax(220px, 1.4fr) repeat(${columns.length}, minmax(46px, 1fr))` }}
      >
        <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary pb-2 pr-3 border-b border-border-light">
          Row
        </div>
        {columns.map((c) => (
          <div
            key={c.key}
            className="text-xs font-semibold uppercase tracking-wider text-text-secondary pb-2 text-center border-b border-border-light"
          >
            {c.label}
          </div>
        ))}

        {rows.map((row) => {
          const scale = rowScales.get(row.rowLabel)
          return (
            <div key={row.rowLabel} className="contents">
              <div className="py-2 pr-4 text-text-primary self-center whitespace-nowrap">
                {renderRowLabel ? renderRowLabel(row.rowLabel) : row.rowLabel}
              </div>
              {columns.map((col) => {
                const cell = row.cells.find((x) => x.colKey === col.key)
                const share = cell?.share ?? 0
                const value = cell?.value ?? 0
                const bg = scale(share)
                const fg = pickTextColor(bg)
                return (
                  <div
                    key={col.key}
                    className="m-0.5 rounded-md flex flex-col items-center justify-center leading-tight"
                    style={{
                      background: bg,
                      color: fg,
                      minHeight: 56,
                    }}
                    title={`${row.rowLabel} · ${col.label} — ${formatValue(value)} (${(share * 100).toFixed(1)}%)`}
                  >
                    <span className="text-[13px] font-semibold tabular-nums">{(share * 100).toFixed(1)}%</span>
                    <span className="text-[12px] tabular-nums">{formatValue(value)}</span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-text-secondary">
        <span>Row low</span>
        <div
          className="h-2 flex-1 max-w-[240px] rounded-sm"
          style={{
            background: `linear-gradient(to right, ${colorRange.join(', ')})`,
          }}
          aria-hidden="true"
        />
        <span>Row high (color scaled within each row)</span>
      </div>
    </div>
  )
}
