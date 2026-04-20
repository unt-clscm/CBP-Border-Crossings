/**
 * ── chartColors.js ──────────────────────────────────────────────────────────
 * Shared color palette and value-formatting utilities used by every D3 chart
 * component and page-level data display (StatCards, DataTable cells, etc.).
 *
 * ── BOILERPLATE: WHAT TO CHANGE FOR A NEW PROJECT ───────────────────────────
 *
 * 1. CHART_COLORS — swap the hex values to match your project's brand palette.
 *    Keep at least 9 colors so multi-series charts (StackedBarChart, LineChart)
 *    don't repeat colors for large category counts.
 *
 * 2. formatCurrency — if your dataset doesn't use dollar values, rename this to
 *    `formatValue` and adjust the prefix/suffix. For example:
 *      - Metric tons: `${sign}${abs.toFixed(0)} t`
 *      - Percentage:  use `formatPercent` instead
 *    Then update every import across chart + page files.
 *
 * 3. getAxisFormatter — follows the same currency convention; adapt the unit
 *    suffixes (T/B/M/K) if your value scale is different (e.g. counts, weight).
 *
 * ────────────────────────────────────────────────────────────────────────────
 */
import * as d3 from 'd3'

/**
 * Brand color palette for charts. The first color is used as the default
 * single-series fill; subsequent colors are cycled by d3.scaleOrdinal for
 * multi-series / stacked charts.
 *
 * BOILERPLATE: Replace these hex values with your project's brand colors.
 */
export const CHART_COLORS = [
  '#0056a9', // TxDOT Blue (primary)
  '#002e69', // Dark Blue
  '#196533', // Dark Green
  '#df5c16', // Light Orange
  '#5f0f40', // Dark Purple
  '#8ec02d', // Light Green
  '#f2ce1b', // Light Yellow
  '#c5bbaa', // Light Brown
  '#d90d0d', // Red (accent — use last)
]

/** Pre-built D3 ordinal scale using the brand palette. */
export const chartColorScale = d3.scaleOrdinal().range(CHART_COLORS)

/**
 * Format a numeric value as a compact string (no currency prefix).
 * Handles null, NaN, and negative values correctly.
 *
 * Examples: 1500000000 → "1.5B", -250000 → "-250.0K", 0 → "0"
 *
 * Used as the default formatValue for all chart components.
 *
 * @param {number} value – the numeric value to format
 * @returns {string} formatted string
 */
export const formatCompact = (value) => {
  if (value == null || isNaN(value)) return '0'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`
  return `${sign}${abs.toFixed(0)}`
}

/**
 * Format a numeric value as a compact currency string.
 * Handles null, NaN, and negative values correctly.
 *
 * Examples: 1500000000 → "$1.5B", -250000 → "-$250.0K", 0 → "$0"
 *
 * @param {number} value – the numeric value to format
 * @returns {string} formatted string
 */
export const formatCurrency = (value) => {
  if (value == null || isNaN(value)) return '$0'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

/**
 * Returns a D3 axis tick formatter that picks the right unit (T/B/M/K) based
 * on tick granularity so labels are clean integers — e.g. 200B, 400B instead
 * of 0.2T. Zero ticks render as empty strings (no clutter at origin).
 *
 * @param {number} maxValue – the maximum data value (used to derive tick step)
 * @param {string} [prefix=''] – optional prefix for tick labels (e.g. '$')
 * @param {string} [suffix=''] – optional suffix for tick labels (e.g. ' lbs')
 * @returns {function} formatter function suitable for d3.axisLeft().tickFormat()
 */
export const getAxisFormatter = (maxValue, prefix = '', suffix = '') => {
  // Choose unit from the approximate tick step (maxValue / 5) so that
  // tick labels come out as whole numbers, not decimals.
  const step = maxValue / 5
  let divisor, unit
  if (step >= 1e12)     { divisor = 1e12; unit = 'T' }
  else if (step >= 1e9) { divisor = 1e9;  unit = 'B' }
  else if (step >= 1e6) { divisor = 1e6;  unit = 'M' }
  else if (step >= 1e3) { divisor = 1e3;  unit = 'K' }
  else                  { divisor = 1;    unit = '' }

  return (v) => {
    if (v === 0) return ''
    const n = v / divisor
    const str = n % 1 === 0 ? n.toLocaleString('en-US') : n.toFixed(1)
    return `${prefix}${str}${unit}${suffix}`
  }
}

/**
 * Locale-aware number formatting (thousands separator).
 * Example: 1234567 → "1,234,567"
 */
export const formatNumber = (value) => {
  if (value == null || isNaN(value)) return '0'
  return new Intl.NumberFormat('en-US').format(Math.round(value))
}

/**
 * Format a decimal as a percentage string.
 * Example: 0.125 → "12.5%"
 */
export const formatPercent = (value) => {
  if (value == null || isNaN(value)) return '—'
  return `${(value * 100).toFixed(1)}%`
}

