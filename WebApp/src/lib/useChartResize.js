/**
 * ── useChartResize.js ───────────────────────────────────────────────────────
 * ResizeObserver hook that provides responsive { width, height, isFullscreen }
 * to every D3 chart component. Charts re-render whenever their container
 * dimensions change (window resize, sidebar collapse, fullscreen toggle).
 *
 * ── BOILERPLATE: NO CHANGES NEEDED ─────────────────────────────────────────
 * This hook is data-agnostic and works with any chart. Only modify if you
 * need to change the fullscreen detection class or font-size scale.
 *
 * ── USAGE ───────────────────────────────────────────────────────────────────
 *   const containerRef = useRef(null)
 *   const { width, height, isFullscreen } = useChartResize(containerRef)
 *   // width/height are the container's inner dimensions in pixels
 *   // isFullscreen is true when the chart is inside a FullscreenChart overlay
 *
 * ────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect } from 'react'

/**
 * Observe a container element's size and report { width, height, isFullscreen }.
 *
 * @param {React.RefObject<HTMLElement>} ref – ref attached to the chart's wrapper div
 * @returns {{ width: number, height: number, isFullscreen: boolean }}
 */
export function useChartResize(ref) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (!ref.current) return

    // Detect fullscreen by checking for the `.fullscreen-chart-area` ancestor
    // class applied by FullscreenChart.jsx
    setIsFullscreen(!!ref.current.closest('.fullscreen-chart-area'))

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDimensions({ width: Math.floor(width), height: Math.floor(height) })
      setIsFullscreen(!!ref.current?.closest('.fullscreen-chart-area'))
    })

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])

  return { ...dimensions, isFullscreen }
}

/**
 * Compute a responsive font size for chart labels based on container width.
 * Returns 16px in normal mode; scales 18–22px in fullscreen.
 *
 * BOILERPLATE: Adjust the min/max values if your design calls for different
 * fullscreen typography.
 *
 * @param {number}  width        – container width in px
 * @param {boolean} isFullscreen – whether the chart is in fullscreen mode
 * @returns {number} font size in px (always >= 16)
 */
export function getResponsiveFontSize(width, isFullscreen) {
  if (!isFullscreen) return 16
  // Scale from 18px at 800px to 22px at 1600px+
  return Math.round(Math.max(18, Math.min(22, 14 + width / 200)))
}
