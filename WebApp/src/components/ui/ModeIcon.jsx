/**
 * ModeIcon — Inline SVG icon for one of the five canonical CBP modes.
 *
 * The underlying SVG files are imported via Vite's `?raw` suffix and their
 * internal `.cls-1` / `.st0` fill is already rewritten to `currentColor`, so
 * the icon inherits the surrounding text color via `style={{ color }}` or any
 * Tailwind text-* utility on the wrapping span.
 */
import busRaw from '@/assets/icons/modes/bus.svg?raw'
import truckRaw from '@/assets/icons/modes/commercial-truck.svg?raw'
import pvRaw from '@/assets/icons/modes/passenger-vehicle.svg?raw'
import pedRaw from '@/assets/icons/modes/pedestrian-bicycle.svg?raw'
import railRaw from '@/assets/icons/modes/rail.svg?raw'

const RAW = {
  'Commercial Trucks': truckRaw,
  Buses: busRaw,
  'Pedestrians/ Bicyclists': pedRaw,
  'Passenger Vehicles': pvRaw,
  Railcars: railRaw,
}

export const MODE_HAS_ICON = (mode) => mode in RAW

// Per-mode size boost. The pedestrian/bicyclist SVG has a wide ~1.92:1 viewBox,
// so when fit into a square box its content only occupies ~52% of the height
// and reads as much smaller than the other icons. Scale it up to compensate.
const SIZE_BOOST = {
  'Pedestrians/ Bicyclists': 1.7,
}

export default function ModeIcon({ mode, size = 18, className = '', title }) {
  const raw = RAW[mode]
  if (!raw) return null
  const boost = SIZE_BOOST[mode] || 1
  const rendered = size * boost
  return (
    <span
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={`inline-flex items-center justify-center flex-shrink-0 [&_svg]:w-full [&_svg]:h-full ${className}`}
      style={{ width: rendered, height: rendered }}
      dangerouslySetInnerHTML={{ __html: raw }}
    />
  )
}

/**
 * Pre-built iconMap keyed by canonical mode name, matching the shape expected
 * by FilterRadioGroup / FilterMultiSelect / FilterCheckboxGroup. Each value is
 * a component that forwards `size` / `className` / `title` to ModeIcon.
 */
export const MODE_ICON_MAP = Object.fromEntries(
  Object.keys(RAW).map((mode) => [
    mode,
    function BoundModeIcon(props) {
      return <ModeIcon mode={mode} {...props} />
    },
  ]),
)
