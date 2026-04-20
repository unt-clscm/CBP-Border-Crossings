/**
 * FullscreenChart.jsx — Full-viewport chart overlay (data-agnostic)
 * -----------------------------------------------------------------
 * Renders a full-screen overlay that is portalled to document.body by ChartCard.
 * It displays the same chart children at full viewport size with enlarged
 * typography and provides its own action buttons (PNG export, CSV download, close).
 *
 * When a parent provides FilterContext (e.g. DashboardLayout with filters), a
 * collapsible filter sidebar appears on the right. Pages without that provider
 * still get fullscreen chart + export actions; the sidebar is omitted.
 *
 * Behavior
 *   - Pressing the Escape key closes the overlay (keydown listener)
 *   - Body scroll is disabled while the overlay is open; restored on unmount
 *   - Uses fixed positioning with z-index 100 and a fade-in animation
 *   - The chart area fills the remaining viewport height below the header bar
 *
 * Props
 *   @param {string}      title        — Chart heading, displayed larger than in ChartCard
 *   @param {string}     [subtitle]    — Optional secondary description line
 *   @param {ReactNode}   children     — The chart component(s) to render at full size
 *   @param {object}     [downloadData] — { summary?: { data, filename }, detail?: { data, filename } }
 *   @param {Function}    onClose      — Callback to close the overlay (called on Escape or button click)
 *
 * BOILERPLATE NOTE:
 *   This component is fully data-agnostic. No changes are needed when adapting
 *   this boilerplate for a new project or dataset.
 */
import { useContext, useEffect, useRef, useState } from 'react'
import { X, Image as ImageIcon, Filter, RotateCcw, PanelRightClose, PanelRightOpen } from 'lucide-react'
import DownloadButton from '@/components/ui/DownloadButton'
import { exportChartPng } from '@/lib/exportPng'
import FilterContext from '@/contexts/FilterContext'
import ActiveFilterTags from '@/components/filters/ActiveFilterTags'

/**
 * Fullscreen overlay for a chart. Renders the chart children at full viewport
 * size with enlarged typography and action buttons.
 */
export default function FullscreenChart({
  title,
  subtitle,
  children,
  downloadData,
  onClose,
}) {
  const chartAreaRef = useRef(null)
  const filterCtx = useContext(FilterContext)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Prevent body scroll while fullscreen is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const handleExportPng = () => {
    exportChartPng(
      chartAreaRef.current,
      title?.replace(/\s+/g, '-').toLowerCase() || 'chart',
      title,
      subtitle,
    )
  }

  const sidebarWidth = sidebarCollapsed ? 'w-12' : 'w-72'

  return (
    <div className="fixed inset-0 z-[100] flex flex-row bg-white animate-fade-in overflow-hidden">
      {/* ── Main content (header + chart area) ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 md:px-8 md:py-5 border-b border-border-light flex-shrink-0">
          {/* Title area */}
          <div className="min-w-0">
            <h2 className="text-xl md:text-3xl font-bold text-text-primary leading-snug truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-base md:text-xl text-text-secondary mt-1 truncate">{subtitle}</p>
            )}
          </div>

          {/* Action buttons — labels hidden on mobile to save space */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            {downloadData && (
              <DownloadButton
                summary={downloadData.summary}
                detail={downloadData.detail}
                size="fullscreen"
              />
            )}
            <button
              onClick={handleExportPng}
              aria-label="Export as PNG"
              className="inline-flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-lg text-base font-medium
                         text-text-secondary bg-surface-alt hover:bg-gray-200
                         border border-border-light transition-all duration-150"
              title="Export as PNG"
            >
              <ImageIcon size={18} />
              <span className="hidden md:inline">Export PNG</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Close fullscreen (Esc)"
              className="inline-flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-lg text-base font-medium
                         text-white bg-brand-blue hover:bg-brand-blue-dark
                         transition-all duration-150"
              title="Close full screen (Esc)"
            >
              <X size={18} />
              <span className="hidden md:inline">Close</span>
            </button>
          </div>
        </div>

        {/* Chart area — fills remaining viewport */}
        <div
          ref={chartAreaRef}
          className="flex-1 p-4 md:p-8 overflow-hidden fullscreen-chart-area"
        >
          {children}
        </div>
      </div>

      {/* ── Filter sidebar (right) ── */}
      {filterCtx && (
        <aside
          aria-label="Filters"
          className={`hidden md:flex flex-col flex-shrink-0 bg-[#edf1f7] border-l border-border-light
            ${sidebarWidth} transition-all duration-300 ease-in-out overflow-hidden`}
        >
          {/* Sidebar header */}
          <div
            className={`flex items-center border-b border-border-light bg-[#e4e9f1] flex-shrink-0
              ${sidebarCollapsed ? 'justify-center py-3 px-1' : 'justify-between px-4 py-3'}`}
          >
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2">
                <Filter size={15} className="text-brand-blue" />
                <span className="text-base font-semibold text-text-primary">Filters</span>
                {filterCtx.activeCount > 0 && (
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full
                                   bg-brand-blue text-white text-base font-bold">
                    {filterCtx.activeCount}
                  </span>
                )}
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label={sidebarCollapsed ? 'Expand filters' : 'Collapse filters'}
              aria-expanded={!sidebarCollapsed}
              className="p-1 rounded-md text-text-secondary hover:text-brand-blue
                         hover:bg-surface-alt transition-all duration-150"
              title={sidebarCollapsed ? 'Expand filters' : 'Collapse filters'}
            >
              {sidebarCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
            </button>
          </div>

          {/* Sidebar scrollable content */}
          <div className="flex-1 overflow-y-auto">
            {!sidebarCollapsed && (
              <div className="p-4 space-y-4 animate-fade-in">
                {/* Active filter tags */}
                <ActiveFilterTags activeTags={filterCtx.activeTags} />

                {/* Reset all */}
                {filterCtx.onResetAll && filterCtx.activeCount > 0 && (
                  <button
                    onClick={filterCtx.onResetAll}
                    className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-base font-medium
                               text-brand-blue border border-brand-blue/30 rounded-lg
                               hover:bg-brand-blue/5 transition-all duration-150"
                  >
                    <RotateCcw size={12} />
                    Reset all filters
                  </button>
                )}

                {filterCtx.activeCount > 0 && <div className="border-b border-border-light" />}

                {/* Filter controls */}
                <div className="w-full min-w-0">
                  {filterCtx.filters}
                </div>
              </div>
            )}

            {/* Collapsed icon indicator */}
            {sidebarCollapsed && filterCtx.activeCount > 0 && (
              <div className="flex flex-col items-center py-3 gap-2">
                <Filter size={14} className="text-brand-blue" />
                <span className="text-base font-bold text-brand-blue bg-brand-blue/10 rounded-full w-6 h-6
                               flex items-center justify-center">
                  {filterCtx.activeCount}
                </span>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  )
}
