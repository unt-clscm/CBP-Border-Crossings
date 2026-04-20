/**
 * useCrossingsMapData.js — Build a markers array for CrossingsMap from the
 * coordinates file (34 rows) and a lookup of yearly totals keyed by
 * `data_crossing_name`.
 *
 * El Paso Railroad Bridges rule: both BNSF and Union Pacific coordinate
 * rows share data_crossing_name = "El Paso Railroad Bridges" and so both
 * pins draw from the same aggregated data row.
 */

/**
 * @param {Array} coords — rows from crossings_coordinates.json
 * @param {Map|object} valuesByDataName — Map<data_crossing_name, number>
 * @returns {Array} [{ name, crossingName, dataCrossingName, lat, lng, value, region, code, order, isRail }]
 */
export function buildMapCrossings(coords, valuesByDataName) {
  if (!coords?.length) return []
  const getValue = (key) => {
    if (!valuesByDataName) return 0
    if (valuesByDataName instanceof Map) return valuesByDataName.get(key) ?? 0
    return valuesByDataName[key] ?? 0
  }
  return coords.map((c) => ({
    name: c.crossing_name,
    crossingName: c.crossing_name,
    dataCrossingName: c.data_crossing_name,
    lat: c.lat,
    lng: c.lon,
    value: getValue(c.data_crossing_name),
    region: c.region,
    portOfEntry: c.port_of_entry,
    code: c.code,
    order: c.order,
    isRail: c.data_crossing_name === 'El Paso Railroad Bridges',
  }))
}

/**
 * Aggregate yearly rows into a { [data_crossing_name]: total } map for a
 * given year (or all years if year is null).
 */
export function aggregateByDataCrossing(yearlyRows, { year = null, modes = null } = {}) {
  const map = new Map()
  if (!yearlyRows?.length) return map
  for (const r of yearlyRows) {
    if (year != null && r.Year !== year) continue
    if (modes?.length && !modes.includes(r.Modes)) continue
    if (!r.Crossing) continue
    map.set(r.Crossing, (map.get(r.Crossing) || 0) + (r['Northbound Crossing'] || 0))
  }
  return map
}
