/**
 * ── DOWNLOAD COLUMN MAPS ─────────────────────────────────────────────────
 *
 * Reusable column-rename maps for CSV downloads. Each map specifies which
 * data keys to include and what header name to use in the exported CSV.
 *
 * Usage: pass as `columns` in the downloadData spec:
 *   downloadData={{ summary: { data, filename, columns: DL.tradeTrend } }}
 */

/* ═══════════════════════════════════════════════════════════════════════════
   CHART-LEVEL COLUMN MAPS  (DL)
   ═══════════════════════════════════════════════════════════════════════════ */

export const DL = {
  /* ── Single-series trends { year, value } ──────────────────────────── */
  crossingsTrend:   { year: 'Year', value: 'Northbound Crossings' },

  /* ── Multi-series trends { year|period, value, series } ───────────── */
  crossingsTrendSeries: { year: 'Year', value: 'Northbound Crossings', series: 'Mode' },
  monthlyTrendSeries:   { period: 'Period', value: 'Northbound Crossings', series: 'Mode' },

  /* ── Rankings / bar charts { label, value } ────────────────────────── */
  crossingRank:     { label: 'Crossing', value: 'Northbound Crossings' },
  modeRank:         { label: 'Mode', value: 'Northbound Crossings' },
  regionRank:       { label: 'Region', value: 'Northbound Crossings' },

  /* ── Shares ────────────────────────────────────────────────────────── */
  modeShare:        { label: 'Mode', value: 'Share (%)' },
}


/* ═══════════════════════════════════════════════════════════════════════════
   PAGE-LEVEL DOWNLOAD COLUMN MAPS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Monthly file: monthly_crossings_2008_2025.json (34,090 rows × 8 cols) */
export const PAGE_MONTHLY_COLS = {
  ID:                     'ID',
  Year:                   'Year',
  Month:                  'Month',
  Region:                 'Region',
  POE:                    'Port of Entry',
  Crossing:               'Crossing',
  Modes:                  'Mode',
  'Northbound Crossing':  'Northbound Crossings',
}

/** Yearly file: yearly_crossings_2008_2025.json (2,850 rows × 7 cols) */
export const PAGE_YEARLY_COLS = {
  ID:                     'ID',
  Year:                   'Year',
  Region:                 'Region',
  POE:                    'Port of Entry',
  Crossing:               'Crossing',
  Modes:                  'Mode',
  'Northbound Crossing':  'Northbound Crossings',
}
