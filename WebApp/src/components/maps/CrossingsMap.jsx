/**
 * ── CrossingsMap.jsx ───────────────────────────────────────────────────
 * Leaflet map of the 34 Texas–Mexico border crossings. Pins are colored by
 * region and sized by the crossing's northbound volume.
 *
 * BNSF and Union Pacific rail pins in El Paso both draw from the single
 * combined "El Paso Railroad Bridges" data row. The popup footnote and
 * click-through to /by-crossing?crossing=El+Paso+Railroad+Bridges make
 * the relationship explicit.
 */
import { useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import {
  ScrollWheelGuard,
  MapResizeHandler,
  ResetZoomButton,
  TooltipSync,
} from './mapHelpers'

const REGION_COLORS = {
  'El Paso':            { fill: '#0056a9', stroke: '#002e69' }, // brand blue
  'Laredo':             { fill: '#d97706', stroke: '#92400e' }, // amber
  'Rio Grande Valley':  { fill: '#16a34a', stroke: '#166534' }, // green
}

const REGION_LEGEND = [
  { label: 'El Paso',            color: REGION_COLORS['El Paso'].fill },
  { label: 'Laredo',             color: REGION_COLORS['Laredo'].fill },
  { label: 'Rio Grande Valley',  color: REGION_COLORS['Rio Grande Valley'].fill },
]

function radiusScale(value, maxValue) {
  if (!maxValue || !value) return 4
  return Math.max(4, Math.min(20, 4 + 16 * Math.sqrt(value / maxValue)))
}

function formatCount(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toLocaleString()
}

/**
 * Props:
 *   crossings      — [{ name, crossingName, dataCrossingName, lat, lng, value, region, code, order, isRail }]
 *   metricLabel    — legend/tooltip suffix (default "Crossings")
 *   formatValue    — (v) => string
 *   height         — CSS height (default "500px")
 *   bounds         — optional [[s,w],[n,e]]; falls back to fit to markers
 *   onMarkerClick  — (marker) => void; if omitted, navigates to /by-crossing?crossing=<dataCrossingName>
 *   highlightNames — optional array of dataCrossingName values to emphasize
 */
export default function CrossingsMap({
  crossings = [],
  metricLabel = 'Crossings',
  formatValue = formatCount,
  height = '500px',
  bounds = null,
  onMarkerClick = null,
  highlightNames = null,
  uniformDots = false, // when true, render all pins at a fixed radius (no value-based sizing)
}) {
  const mapInstanceRef = useRef(null)
  const navigate = useNavigate()
  const [tooltip, setTooltip] = useState(null)
  const [mapActive, setMapActive] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const hintTimer = useRef(null)

  const maxValue = useMemo(
    () => Math.max(1, ...crossings.map((c) => c.value || 0)),
    [crossings],
  )

  const fitBounds = useMemo(() => {
    if (bounds) return bounds
    if (!crossings.length) return null
    const latLngs = crossings
      .filter((c) => c.lat != null && c.lng != null)
      .map((c) => [c.lat, c.lng])
    if (!latLngs.length) return null
    const b = L.latLngBounds(latLngs).pad(0.1)
    return [[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]]
  }, [bounds, crossings])

  // Apply bounds to the map once it's mounted / when bounds change.
  useEffect(() => {
    const map = mapInstanceRef.current
    if (map && fitBounds) {
      map.fitBounds(fitBounds)
    }
  }, [fitBounds])

  const handleWheel = useCallback(() => {
    if (!mapActive) {
      setShowHint(true)
      clearTimeout(hintTimer.current)
      hintTimer.current = setTimeout(() => setShowHint(false), 1500)
    }
  }, [mapActive])

  useEffect(() => () => clearTimeout(hintTimer.current), [])

  const highlightSet = useMemo(
    () => (highlightNames?.length ? new Set(highlightNames) : null),
    [highlightNames],
  )

  const handleClick = useCallback((marker) => {
    if (onMarkerClick) {
      onMarkerClick(marker)
      return
    }
    navigate(`/by-crossing?crossing=${encodeURIComponent(marker.dataCrossingName)}`)
  }, [onMarkerClick, navigate])

  return (
    <>
      <div
        style={{ minHeight: height, width: '100%' }}
        className="crossings-map-container h-full flex flex-col rounded-lg overflow-hidden border border-border-light isolate"
        role="region"
        aria-label={`Border crossings map showing ${metricLabel}`}
      >
        <div className="flex-1 relative" style={{ minHeight: 0 }} onWheel={handleWheel}>
          {showHint && (
            <div
              style={{
                position: 'absolute', inset: 0, zIndex: 1000,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.25)', pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  background: 'rgba(0,0,0,0.7)', color: '#fff',
                  padding: '8px 16px', borderRadius: 6, fontSize: 16,
                }}
              >
                Click the map to enable zooming
              </span>
            </div>
          )}

          <MapContainer
            center={[29.5, -100.5]}
            zoom={6}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            scrollWheelZoom={false}
            zoomControl
            ref={(instance) => { mapInstanceRef.current = instance }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ScrollWheelGuard onActiveChange={setMapActive} />
            <ResetZoomButton center={[29.5, -100.5]} zoom={6} />
            <MapResizeHandler />
            <TooltipSync mapRef={mapInstanceRef} tooltip={tooltip} setTooltip={setTooltip} />

            {crossings
              .filter((c) => c.lat != null && c.lng != null)
              .map((c) => {
                const r = uniformDots ? 6 : radiusScale(c.value, maxValue)
                const palette = REGION_COLORS[c.region] || { fill: '#6b7280', stroke: '#374151' }
                const dim = highlightSet && !highlightSet.has(c.dataCrossingName)
                return (
                  <CircleMarker
                    key={c.code}
                    center={[c.lat, c.lng]}
                    radius={r}
                    bubblingMouseEvents={false}
                    pathOptions={{
                      fillColor: palette.fill,
                      color: palette.stroke,
                      weight: 1.5,
                      opacity: dim ? 0.25 : 0.9,
                      fillOpacity: dim ? 0.2 : 0.85,
                    }}
                    eventHandlers={{
                      click: () => handleClick(c),
                      mouseover: () => {
                        const map = mapInstanceRef.current
                        if (!map) return
                        const pt = map.latLngToContainerPoint([c.lat, c.lng])
                        const rect = map.getContainer().getBoundingClientRect()
                        setTooltip({
                          content: (
                            <>
                              <strong>{c.crossingName}</strong>
                              <br />
                              <span style={{ color: '#555', fontSize: 12 }}>{c.region} region</span>
                              {!uniformDots && (
                                <>
                                  <br />
                                  {formatValue(c.value)} {metricLabel}
                                </>
                              )}
                              {c.isRail && (
                                <>
                                  <br />
                                  <span style={{ fontSize: 11, color: '#777', fontStyle: 'italic' }}>
                                    CBP reports northbound railcars for BNSF and Union Pacific as a single combined total;
                                    <br />
                                    this figure is the combined count for both bridges.
                                  </span>
                                </>
                              )}
                            </>
                          ),
                          x: rect.left + pt.x,
                          y: rect.top + pt.y - r - 8,
                          latLng: [c.lat, c.lng],
                          offsetY: -r - 8,
                          isRail: !!c.isRail,
                        })
                      },
                      mouseout: () => setTooltip(null),
                    }}
                  />
                )
              })}
          </MapContainer>
        </div>

        {/* Legend */}
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 bg-white/90 text-base text-text-secondary border-t border-border-light flex-shrink-0"
        >
          {REGION_LEGEND.map((g) => (
            <span key={g.label} className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: g.color }} />
              {g.label}
            </span>
          ))}
          {!uniformDots && (
            <span className="flex items-center gap-1.5">
              <svg width="24" height="16" aria-hidden="true" className="flex-shrink-0">
                <circle cx="7" cy="11" r="3" fill="#999" opacity="0.5" />
                <circle cx="17" cy="8" r="6" fill="#999" opacity="0.5" />
              </svg>
              Size = {metricLabel}
            </span>
          )}
        </div>
      </div>

      {/* Portal tooltip */}
      {tooltip &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: tooltip.x,
              top: tooltip.y,
              transform: tooltip.sticky ? 'none' : 'translate(-50%, -100%)',
              zIndex: 10000,
              pointerEvents: 'none',
              background: 'white',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 13,
              lineHeight: 1.4,
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              whiteSpace: tooltip.isRail ? 'normal' : 'nowrap',
              maxWidth: tooltip.isRail ? 280 : undefined,
              fontFamily: 'var(--font-sans), system-ui, sans-serif',
            }}
          >
            {tooltip.content}
          </div>,
          document.body,
        )}
    </>
  )
}
