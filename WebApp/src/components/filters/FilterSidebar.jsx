/**
 * ── FILTER SIDEBAR ──────────────────────────────────────────────────────
 *
 * Sticky right-side sidebar that provides filter controls for dashboard pages.
 * This component is rendered by DashboardLayout and receives filter controls
 * as children from each page component.
 *
 * Features:
 *   - Collapse/expand toggle (PanelRightClose / PanelRightOpen icons)
 *   - Active filter tags — grouped by filter category with individual
 *     remove buttons (X) for each selected value
 *   - "Reset all filters" button — visible when any filters are active
 *   - "Back to top" button — appears after scrolling past 300px
 *   - Sticky positioning — sidebar sticks to top of viewport within
 *     the flex layout, scrolling its own content independently
 *
 * Props:
 *   - children      — Filter control components (FilterSelect, FilterMultiSelect)
 *                      passed from the page via DashboardLayout's `filters` prop
 *   - onResetAll    — Callback to clear all filters (provided by the page)
 *   - activeCount   — Number of active filter categories (drives badge count)
 *   - activeTags    — Array of { group, label, onRemove } for rendering tags
 *   - title         — Sidebar header text (default: "Filters")
 *
 * ── BOILERPLATE: HOW TO ADAPT ───────────────────────────────────────────
 * No changes are typically needed in this file when adapting for a new
 * dataset. Filter controls are defined in each page component and passed
 * as children. Only modify this if you want to change the sidebar's
 * layout, styling, collapse behavior, or add/remove global sidebar features.
 */
import { useState, useEffect, useRef } from 'react'
import { Filter, RotateCcw, PanelRightClose, PanelRightOpen, ArrowUp } from 'lucide-react'
import ActiveFilterTags from '@/components/filters/ActiveFilterTags'
import PageDataDownloadButton from '@/components/filters/PageDataDownloadButton'

export default function FilterSidebar({ children, onResetAll, activeCount = 0, activeTags = [], title = 'Filters', pageDownload }) {
  const [collapsed, setCollapsed] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const lastScrollTopRef = useRef(false)

  useEffect(() => {
    const onScroll = () => {
      const shouldShow = window.scrollY > 300
      if (shouldShow !== lastScrollTopRef.current) {
        lastScrollTopRef.current = shouldShow
        setShowScrollTop(shouldShow)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const width = collapsed ? 'w-12' : 'w-72'

  return (
      <aside
        aria-label="Filters"
        className={`sticky top-0 self-start h-screen flex-shrink-0 flex flex-col z-40
          bg-[#edf1f7] border-l border-border-light shadow-sm
          transition-all duration-300 ease-in-out
          ${width}
        `}
      >
        {/* Header — always visible, never scrolls */}
        <div
          className={`flex items-center border-b border-border-light bg-[#e4e9f1] flex-shrink-0
            ${collapsed ? 'justify-center py-3 px-1' : 'justify-between px-4 py-3'}`}
        >
          {!collapsed && (
            <div className="flex items-center gap-2">
              <Filter size={15} className="text-brand-blue" />
              <span className="text-base font-semibold text-text-primary">{title}</span>
              {activeCount > 0 && (
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full
                               bg-brand-blue text-white text-base font-bold">
                  {activeCount}
                </span>
              )}
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand filters' : 'Collapse filters'}
            aria-expanded={!collapsed}
            className="p-1 rounded-md text-text-secondary hover:text-brand-blue
                       hover:bg-surface-alt transition-all duration-150"
            title={collapsed ? 'Expand filters' : 'Collapse filters'}
          >
            {collapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Content */}
          {!collapsed && (
            <div className="p-4 space-y-4 animate-fade-in">
              <ActiveFilterTags activeTags={activeTags} />
              {/* Reset — right below active tags */}
              {onResetAll && activeCount > 0 && (
                <button
                  onClick={onResetAll}
                  className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-base font-medium
                             text-brand-blue border border-brand-blue/30 rounded-lg
                             hover:bg-brand-blue/5 transition-all duration-150"
                >
                  <RotateCcw size={12} />
                  Reset all filters
                </button>
              )}
              {activeCount > 0 && <div className="border-b border-border-light" />}
              <div className="w-full min-w-0">
                {children}
              </div>

              {/* Scroll to top */}
              {showScrollTop && (
                <button
                  onClick={scrollToTop}
                  className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-base font-medium
                             text-text-secondary border border-border-light rounded-lg
                             hover:text-brand-blue hover:border-brand-blue/30 hover:bg-brand-blue/5
                             transition-all duration-200 mt-1"
                >
                  <ArrowUp size={12} />
                  Back to top
                </button>
              )}

              {/* Page-level data download */}
              {pageDownload && (
                <div className="border-t border-border-light pt-4 mt-2">
                  <PageDataDownloadButton pageDownload={pageDownload} />
                </div>
              )}
            </div>
          )}

          {/* Collapsed icon indicator */}
          {collapsed && activeCount > 0 && (
            <div className="flex flex-col items-center py-3 gap-2">
              <Filter size={14} className="text-brand-blue" />
              <span className="text-base font-bold text-brand-blue bg-brand-blue/10 rounded-full w-6 h-6
                             flex items-center justify-center">
                {activeCount}
              </span>
            </div>
          )}

          {/* Collapsed scroll to top */}
          {collapsed && showScrollTop && (
            <div className="flex justify-center py-2">
              <button
                onClick={scrollToTop}
                aria-label="Back to top"
                className="p-1.5 rounded-md text-text-secondary hover:text-brand-blue
                           hover:bg-surface-alt transition-all duration-150"
                title="Back to top"
              >
                <ArrowUp size={14} />
              </button>
            </div>
          )}
        </div>

      </aside>
  )
}
