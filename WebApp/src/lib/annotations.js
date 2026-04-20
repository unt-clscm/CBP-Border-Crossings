/**
 * Shared historical annotations for line charts.
 * Use ANNOTATIONS_FULL for charts showing pre-2007 data (Overview page).
 * Use ANNOTATIONS_MODERN for charts starting at 2007+ (detail pages).
 */

export const ANNOTATIONS_MODERN = [
  { x: 2008.5, x2: 2009.5, label: '2008 Financial Crisis', color: 'rgba(245,158,11,0.08)', labelColor: '#b45309' },
  { x: 2019.5, x2: 2020.5, label: 'COVID-19', color: 'rgba(217,13,13,0.08)', labelColor: '#d90d0d' },
]

export const ANNOTATIONS_FULL = [
  { x: 1993.5, x2: 1994.5, label: 'NAFTA Begins', color: 'rgba(16,185,129,0.08)', labelColor: '#047857' },
  ...ANNOTATIONS_MODERN,
]
