/**
 * FilterBar.jsx — Inline filter toolbar (data-agnostic)
 * -----------------------------------------------------
 * Compact alternative to the right FilterSidebar layout. Keeps filter controls
 * in the main content flow with an active-count badge and optional reset action.
 *
 * BOILERPLATE NOTE:
 *   This component is currently not used by the primary pages (they use
 *   DashboardLayout + FilterSidebar), but it is kept as a reusable pattern for
 *   future page variants that need top-mounted filters instead of a sidebar.
 */
import { Filter, RotateCcw } from 'lucide-react'
import PageDataDownloadButton from '@/components/filters/PageDataDownloadButton'

export default function FilterBar({ children, onResetAll, activeCount = 0, pageDownload }) {
  return (
    <div className="bg-white rounded-xl border border-border-light shadow-xs p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-brand-blue" />
          <span className="text-base font-semibold text-text-primary">Filters</span>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full
                           bg-brand-blue text-white text-base font-bold">
              {activeCount}
            </span>
          )}
        </div>
        {onResetAll && activeCount > 0 && (
          <button
            onClick={onResetAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-base font-medium
                       text-brand-blue border border-brand-blue/30 rounded-full
                       hover:bg-brand-blue/5 transition-all duration-150"
          >
            <RotateCcw size={12} />
            Reset all
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {children}
      </div>
      {pageDownload && (
        <div className="border-t border-border-light pt-3 mt-3">
          <PageDataDownloadButton pageDownload={pageDownload} />
        </div>
      )}
    </div>
  )
}
