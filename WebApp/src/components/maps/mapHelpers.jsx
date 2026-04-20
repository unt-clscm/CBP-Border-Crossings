/**
 * ── mapHelpers.jsx ──────────────────────────────────────────────────────
 * Shared Leaflet map helper components. Used by CrossingsMap.
 */
import { useCallback, useEffect } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'

/** Disables scroll-wheel zoom until the user clicks on the map */
export function ScrollWheelGuard({ onActiveChange }) {
  const map = useMap()
  useMapEvents({
    click: () => { map.scrollWheelZoom.enable(); onActiveChange?.(true) },
    mouseout: () => { map.scrollWheelZoom.disable(); onActiveChange?.(false) },
  })
  return null
}

/** Invalidates Leaflet map size when container dimensions change */
export function MapResizeHandler() {
  const map = useMap()
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 100)
    const observer = new ResizeObserver(() => map.invalidateSize())
    const container = map.getContainer()
    if (container.parentElement) observer.observe(container.parentElement)
    return () => { clearTimeout(timer); observer.disconnect() }
  }, [map])
  return null
}

/** Fits the map to the given bounds whenever they change. Runs inside
 *  MapContainer so the map instance is guaranteed to exist. Defers the
 *  fit via rAF + a fallback timeout so Leaflet has laid out its container
 *  (otherwise the first fit can silently no-op when the container is 0×0). */
export function FitBoundsHandler({ bounds }) {
  const map = useMap()
  const key = bounds ? JSON.stringify(bounds) : null
  useEffect(() => {
    if (!map || !bounds) return
    let raf = 0
    let timer = 0
    const apply = () => {
      map.invalidateSize()
      map.fitBounds(bounds)
    }
    raf = requestAnimationFrame(() => { timer = setTimeout(apply, 150) })
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [map, key]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/** Button to reset the map to initial center/zoom */
export function ResetZoomButton({ center, zoom }) {
  const map = useMap()
  const handleClick = useCallback((e) => {
    e.stopPropagation()
    map.setView(center, zoom)
  }, [map, center, zoom])

  return (
    <div className="leaflet-top leaflet-left" style={{ pointerEvents: 'auto' }}>
      <div className="leaflet-control" style={{ marginTop: 80, marginLeft: 10 }}>
        <button
          onClick={handleClick}
          title="Reset zoom"
          style={{
            background: '#fff', border: '2px solid rgba(0,0,0,0.2)', borderRadius: 4,
            width: 34, height: 34, cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 18, lineHeight: 1, color: '#333',
          }}
        >
          &#8962;
        </button>
      </div>
    </div>
  )
}

/** Captures map instance ref & repositions portal tooltips on map move/zoom */
export function TooltipSync({ mapRef, tooltip, setTooltip }) {
  const map = useMap()
  useEffect(() => { mapRef.current = map }, [map, mapRef])
  useEffect(() => {
    if (!tooltip?.latLng) return
    const update = () => {
      const pt = map.latLngToContainerPoint(tooltip.latLng)
      const rect = map.getContainer().getBoundingClientRect()
      setTooltip((prev) =>
        prev?.latLng
          ? { ...prev, x: rect.left + pt.x, y: rect.top + pt.y + (prev.offsetY || 0) }
          : null,
      )
    }
    map.on('move zoom', update)
    return () => map.off('move zoom', update)
  }, [map, tooltip?.latLng, tooltip?.offsetY, setTooltip])
  return null
}

