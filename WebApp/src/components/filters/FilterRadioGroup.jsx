/**
 * FilterRadioGroup — Always-visible single-select radio list.
 *
 * Use for small, fixed option sets where summing across options would be
 * meaningless (e.g. Mode: trucks vs. pedestrians vs. railcars — unit-
 * incompatible). Shows all options inline so users can see the choices
 * without opening a dropdown.
 *
 * Contract:
 *   - `value` is a single option value (string); must always be non-null.
 *   - `onChange` receives the next value (never null).
 *   - `options` accepts strings or { value, label } objects.
 */
import { useId } from 'react'

function getVal(opt) {
  return typeof opt === 'string' ? opt : opt.value
}
function getLbl(opt) {
  return typeof opt === 'string' ? opt : opt.label
}

export default function FilterRadioGroup({
  label,
  value,
  options = [],
  onChange,
  name,
  iconMap,
}) {
  const id = useId()
  const groupName = name || `${id}-radio`

  return (
    <div className="flex flex-col gap-1 min-w-0 w-full">
      <span className="text-base font-medium text-text-secondary uppercase tracking-wider">
        {label}
      </span>
      <div role="radiogroup" aria-label={label} className="flex flex-col mt-1">
        {options.map((opt) => {
          const val = getVal(opt)
          const lbl = getLbl(opt)
          const selected = value === val
          const Icon = iconMap?.[val]
          return (
            <label
              key={val}
              className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors ${selected ? 'bg-brand-blue/10' : 'hover:bg-brand-blue/5'}`}
            >
              <input
                type="radio"
                name={groupName}
                value={val}
                checked={selected}
                onChange={() => onChange(val)}
                className="sr-only"
              />
              <span
                className={`flex-shrink-0 flex items-center justify-center w-4 h-4 rounded-full border-2 ${selected ? 'border-brand-blue' : 'border-border'}`}
              >
                {selected && <span className="w-2 h-2 rounded-full bg-brand-blue" />}
              </span>
              {Icon && (
                <Icon
                  className={selected ? 'text-brand-blue' : 'text-text-secondary'}
                />
              )}
              <span className={`text-sm ${selected ? 'font-medium text-brand-blue' : 'text-text-primary'}`}>
                {lbl}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
