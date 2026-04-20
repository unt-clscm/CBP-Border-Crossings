/**
 * FilterCheckboxGroup — Always-visible multi-select checkbox list.
 *
 * Matches FilterRadioGroup visually, but each row is a checkbox so the user
 * can pick any combination. Includes a top-of-list "All" row that selects
 * every option at once (represented internally as value = []).
 *
 * Contract:
 *   - `value` is an array of selected option values. `[]` means "all".
 *   - `onChange` receives the next array (canonical empty-array when all are selected).
 *   - `options` accepts strings or { value, label } objects.
 *   - `colorMap` (optional) maps option value → hex color; rows with a color
 *     show a small swatch dot and adopt the color in their selected state.
 */
import { Check } from 'lucide-react'

function getVal(opt) {
  return typeof opt === 'string' ? opt : opt.value
}
function getLbl(opt) {
  return typeof opt === 'string' ? opt : opt.label
}

export default function FilterCheckboxGroup({
  label,
  value = [],
  options = [],
  onChange,
  allLabel = 'All',
  colorMap,
}) {
  const allValues = options.map(getVal)
  const allSelected = value.length === 0

  const toggle = (val) => {
    if (value.includes(val)) {
      const next = value.filter((v) => v !== val)
      onChange(next)
    } else {
      const next = [...value, val]
      onChange(next.length === allValues.length ? [] : next)
    }
  }

  const selectAll = () => onChange([])

  return (
    <div className="flex flex-col gap-1 min-w-0 w-full">
      <span className="text-base font-medium text-text-secondary uppercase tracking-wider">
        {label}
      </span>
      <div role="group" aria-label={label} className="flex flex-col gap-1.5 mt-1">
        <label
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${allSelected ? 'border-brand-blue bg-brand-blue/10' : 'border-border hover:bg-brand-blue/5'}`}
        >
          <input
            type="checkbox"
            checked={allSelected}
            onChange={selectAll}
            className="sr-only"
          />
          <span
            className={`flex-shrink-0 flex items-center justify-center w-4 h-4 rounded border ${allSelected ? 'bg-brand-blue border-brand-blue' : 'border-border'}`}
          >
            {allSelected && <Check size={12} className="text-white" />}
          </span>
          <span className={`text-sm ${allSelected ? 'font-medium text-brand-blue' : 'text-text-primary'}`}>
            {allLabel}
          </span>
        </label>
        {options.map((opt) => {
          const val = getVal(opt)
          const lbl = getLbl(opt)
          const checked = value.includes(val)
          const color = colorMap?.[val]
          const rowStyle = color && checked
            ? { borderColor: color, backgroundColor: `${color}1A` }
            : undefined
          const boxStyle = color && checked
            ? { backgroundColor: color, borderColor: color }
            : undefined
          const textStyle = color && checked ? { color } : undefined
          return (
            <label
              key={val}
              style={rowStyle}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                checked
                  ? color ? 'border' : 'border-brand-blue bg-brand-blue/10'
                  : 'border-border hover:bg-brand-blue/5'
              }`}
            >
              <input
                type="checkbox"
                value={val}
                checked={checked}
                onChange={() => toggle(val)}
                className="sr-only"
              />
              <span
                style={boxStyle}
                className={`flex-shrink-0 flex items-center justify-center w-4 h-4 rounded border ${
                  checked
                    ? color ? '' : 'bg-brand-blue border-brand-blue'
                    : 'border-border'
                }`}
              >
                {checked && <Check size={12} className="text-white" />}
              </span>
              {color && (
                <span
                  aria-hidden="true"
                  className="flex-shrink-0 inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
              )}
              <span
                style={textStyle}
                className={`text-sm ${
                  checked
                    ? color ? 'font-medium' : 'font-medium text-brand-blue'
                    : 'text-text-primary'
                }`}
              >
                {lbl}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
