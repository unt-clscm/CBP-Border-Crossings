import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * Inline error banner shown when a lazy-loaded dataset fails.
 * Renders inside the same slot where the loading spinner normally sits.
 */
export default function DatasetError({ datasetName, error, onRetry }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md px-6">
        <AlertTriangle size={40} className="text-brand-orange mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-text-primary mb-1">
          Failed to load data
        </h3>
        <p className="text-base text-text-secondary mb-1">
          The <span className="font-medium">{datasetName}</span> dataset could
          not be loaded.
        </p>
        <p className="text-sm text-text-secondary/70 font-mono break-all mb-4">
          {error}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white
                       bg-brand-blue rounded-lg hover:bg-brand-blue-dark transition-colors"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
