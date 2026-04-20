/**
 * FilterSelect.jsx — Generic single-select filter control (data-agnostic)
 * -----------------------------------------------------------------------
 * Renders a labeled <select> with:
 *   - An "All" option (empty string) to disable the filter
 *   - String options (e.g. "Export")
 *   - Object options ({ value, label }) for explicit mapping
 *
 * BOILERPLATE NOTE:
 *   This component is reusable across datasets. Adaptation usually happens in
 *   page-level filter option builders (src/pages/*), not in this component.
 */
import { useId } from 'react'
import { ChevronDown } from 'lucide-react'

export default function FilterSelect({ label, value, options = [], onChange, allLabel = 'All', disabledValues = [] }) {
  const id = useId()
  const disabledSet = disabledValues.length ? new Set(disabledValues) : null
  return (
    <div className="flex flex-col gap-1 min-w-0 w-full">
      <label htmlFor={id} className="text-base font-medium text-text-secondary uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none w-full px-3 py-2 pr-8 rounded-lg border border-border
                     bg-white text-base text-text-primary
                     focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue
                     transition-all duration-150 cursor-pointer"
        >
          <option value="">{allLabel}</option>
          {options.map((opt) => {
            const val = typeof opt === 'string' ? opt : opt.value
            const lbl = typeof opt === 'string' ? opt : opt.label
            const disabled = disabledSet?.has(val)
            return (
              <option key={val} value={val} disabled={disabled}>
                {disabled ? `${lbl} (no data)` : lbl}
              </option>
            )
          })}
        </select>
        <ChevronDown
          size={14}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
        />
      </div>
    </div>
  )
}
