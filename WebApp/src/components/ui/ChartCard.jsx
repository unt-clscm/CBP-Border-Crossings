/**
 * ChartCard.jsx — Universal chart wrapper (data-agnostic)
 * -------------------------------------------------------
 * Wraps every chart in the dashboard with a consistent card UI that includes:
 *   - Title and optional subtitle
 *   - Action buttons: CSV download (via DownloadButton), PNG export, fullscreen toggle,
 *     and an optional reset-filter button
 *   - A slot (`headerRight`) for custom controls injected by the parent
 *
 * ZoomRangeContext
 *   This component creates and provides a ZoomRangeContext so that child chart
 *   components (e.g. LineChart with D3 brush zoom) can call
 *     setZoomRange({ xKey, min, max })
 *   to report the currently visible data range. ChartCard then uses that range
 *   to filter the `downloadData` before passing it to DownloadButton, so the
 *   exported CSV only contains the rows visible in the zoomed view.
 *   Call setZoomRange(null) on reset to revert to the full dataset.
 *
 * Fullscreen
 *   When the user clicks the expand button, ChartCard portals a <FullscreenChart>
 *   overlay to document.body, passing the same children and download data.
 *
 * Props
 *   @param {string}      title          — Card heading text
 *   @param {string}     [subtitle]      — Optional secondary description line
 *   @param {ReactNode}   children       — The chart component(s) to render
 *   @param {Function}   [onReset]       — If provided, shows a reset-filter button
 *   @param {string}     [className]     — Additional CSS classes for the outer card
 *   @param {number}     [minHeight=320] — Minimum height for the chart area (px)
 *   @param {ReactNode}  [headerRight]   — Extra controls rendered in the header row
 *   @param {object}     [downloadData]  — { summary?: { data, filename }, detail?: { data, filename } }
 *   @param {ReactNode}  [footnote]      — Annotation text rendered below the chart area but inside the card
 *   @param {string}     [emptyState]    — When truthy, replaces chart content with a centered message
 *                                         (e.g. "No passenger data for the current filter selection.")
 *
 * BOILERPLATE NOTE:
 *   This component is fully data-agnostic. When adapting this boilerplate for a
 *   new project/dataset, you should NOT need to modify this file. Instead, pass
 *   different props from the parent page components.
 */
import { useRef, useState, useMemo, useEffect, createContext, Children, isValidElement } from 'react'
import { createPortal } from 'react-dom'
import { RotateCcw, Image as ImageIcon, Maximize2 } from 'lucide-react'
import DownloadButton from '@/components/ui/DownloadButton'
import FullscreenChart from '@/components/ui/FullscreenChart'
import { exportChartPng } from '@/lib/exportPng'

/** Child charts (e.g. LineChart) call setZoomRange({ xKey, min, max }) during zoom
 *  and setZoomRange(null) on reset so ChartCard can filter download data. */
// eslint-disable-next-line react-refresh/only-export-components
export const ZoomRangeContext = createContext(null)

export default function ChartCard({
  title,
  subtitle,
  children,
  onReset,
  className = '',
  minHeight = 200,
  headerRight,
  downloadData,
  footnote,
  emptyState,
}) {
  const chartAreaRef = useRef(null)
  const [zoomRange, setZoomRange] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // DEV WARNING: Detect annotation text placed as children instead of footnote.
  // Chart containers use h-full, so sibling elements get pushed below the visible
  // area and clipped by overflow-hidden, appearing as faint "lines" at the bottom.
  useEffect(() => {
    if (import.meta.env.DEV) {
      let hasNonChart = false
      Children.forEach(children, (child) => {
        if (isValidElement(child) && typeof child.type === 'string' && child.type === 'p') {
          hasNonChart = true
        }
      })
      if (hasNonChart) {
        console.warn(
          `[ChartCard] "${title}": <p> elements found in children. ` +
          'Move annotation text to the `footnote` prop to prevent clipping. ' +
          'See CLAUDE.md "ChartCard footnote" section.',
        )
      }
    }
  }, [children, title])

  const handleExportPng = async () => {
    try {
      await exportChartPng(
        chartAreaRef.current,
        title?.replace(/\s+/g, '-').toLowerCase() || 'chart',
        title,
        subtitle,
      )
    } catch (err) {
      console.error('PNG export failed:', err)
    }
  }

  // Filter download data to the visible zoom range
  const effectiveDownloadData = useMemo(() => {
    if (!downloadData || !zoomRange) return downloadData
    const { xKey, min, max } = zoomRange

    const filterArr = (arr) => {
      if (!arr?.length) return arr
      // Try exact xKey, then capitalized variant (e.g. year → Year)
      const capKey = xKey.charAt(0).toUpperCase() + xKey.slice(1)
      const key = arr[0][xKey] !== undefined ? xKey : (arr[0][capKey] !== undefined ? capKey : null)
      if (!key) return arr
      return arr.filter((d) => d[key] >= min && d[key] <= max)
    }

    return {
      ...downloadData,
      summary: downloadData.summary
        ? { ...downloadData.summary, data: filterArr(downloadData.summary.data) }
        : undefined,
      detail: downloadData.detail
        ? { ...downloadData.detail, data: filterArr(downloadData.detail.data) }
        : undefined,
    }
  }, [downloadData, zoomRange])

  return (
    <ZoomRangeContext.Provider value={setZoomRange}>
      <div
        className={`bg-white rounded-xl border border-border-light shadow-xs min-w-0
                    hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden
                    flex flex-col ${className}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-3 pt-5 pb-3">
          <div className="min-w-0">
            <h3 className="text-xl font-semibold text-text-primary leading-snug">
              {title}
            </h3>
            {subtitle && (
              <p className="text-base text-text-secondary mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 group/actions">
            {headerRight}
            {effectiveDownloadData && (
              <DownloadButton
                summary={effectiveDownloadData.summary}
                detail={effectiveDownloadData.detail}
              />
            )}
            <button
              onClick={handleExportPng}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-text-secondary hover:text-brand-blue
                         hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue transition-all duration-150"
              aria-label="Export as PNG"
              title="Export as PNG"
            >
              <ImageIcon size={14} />
            </button>
            <button
              onClick={() => setIsFullscreen(true)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-text-secondary hover:text-brand-blue
                         hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue transition-all duration-150"
              aria-label="Full screen"
              title="Full screen"
            >
              <Maximize2 size={14} />
            </button>
            {onReset && (
              <button
                onClick={onReset}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-text-secondary hover:text-brand-blue
                           hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue transition-all duration-150"
                aria-label="Reset filter"
                title="Reset filter"
              >
                <RotateCcw size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Chart Area — DO NOT add fixed height or max-height here.
            Chart components set their own minHeight based on data/legend needs.
            The flex-1 lets this area grow; the chart's inline minHeight drives expansion.
            When fullscreen is active, hide card children to avoid duplicate Leaflet maps. */}
        <div ref={chartAreaRef} className={`px-3 flex-1 ${footnote && !emptyState ? 'pb-2' : 'pb-5'}`} style={{ minHeight }} role="figure" aria-label={title ? `Chart: ${title}` : undefined}>
          {emptyState ? (
            <div className="flex items-center justify-center h-48 text-text-secondary italic text-base px-4 text-center">
              {emptyState}
            </div>
          ) : (
            !isFullscreen && children
          )}
        </div>

        {/* Footnote — rendered outside the chart area (separate flex child) so it
            is never clipped by overflow-hidden when chart containers use h-full.
            Hidden when emptyState is active (footnote describes chart that isn't shown). */}
        {footnote && !emptyState && !isFullscreen && (
          <div className="px-3 pb-5">
            {footnote}
          </div>
        )}
      </div>

      {/* Fullscreen overlay (portalled to body) */}
      {isFullscreen &&
        createPortal(
          <FullscreenChart
            title={title}
            subtitle={subtitle}
            downloadData={effectiveDownloadData}
            onClose={() => setIsFullscreen(false)}
          >
            {children}
          </FullscreenChart>,
          document.body,
        )}
    </ZoomRangeContext.Provider>
  )
}
