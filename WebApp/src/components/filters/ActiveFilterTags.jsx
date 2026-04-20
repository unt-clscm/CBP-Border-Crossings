/**
 * ActiveFilterTags — Shared pill display for active filter selections
 * -------------------------------------------------------------------
 * Renders grouped filter tags (blue pills) with individual remove buttons.
 * Used by both FilterSidebar and FullscreenChart to keep styling in sync.
 *
 * Props:
 *   - activeTags — Array of { group, label, onRemove }
 */
import { X } from 'lucide-react'

export default function ActiveFilterTags({ activeTags = [] }) {
  if (activeTags.length === 0) return null

  const groups = []
  const seen = new Set()
  activeTags.forEach((tag) => {
    const g = tag.group || ''
    if (!seen.has(g)) { seen.add(g); groups.push(g) }
  })

  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <div key={group} className="flex flex-wrap items-center gap-1.5">
          {group && (
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider mr-0.5">
              {group}:
            </span>
          )}
          {activeTags.filter((t) => (t.group || '') === group).map((tag) => (
            <span
              key={tag.label}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium
                         bg-brand-blue/10 text-brand-blue border border-brand-blue/20"
            >
              {tag.label}
              <button
                onClick={tag.onRemove}
                className="hover:bg-brand-blue/20 rounded-full p-0.5 transition-colors"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}
