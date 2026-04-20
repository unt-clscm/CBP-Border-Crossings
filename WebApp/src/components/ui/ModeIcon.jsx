/**
 * ModeIcon — Inline icon for one of the five canonical CBP modes.
 *
 * The underlying SVG files are imported via Vite's `?url` suffix so they
 * ship as separate static assets instead of being inlined into the JS
 * bundle as raw strings (bus.svg alone is ~249 kB — that cost was landing
 * on the initial paint). The shape is applied via CSS `mask-image`, and
 * the fill comes from `background-color: currentColor`, so the icon still
 * inherits surrounding text color (e.g. `text-brand-blue`).
 */
import busUrl from '@/assets/icons/modes/bus.svg?url'
import truckUrl from '@/assets/icons/modes/commercial-truck.svg?url'
import pvUrl from '@/assets/icons/modes/passenger-vehicle.svg?url'
import pedUrl from '@/assets/icons/modes/pedestrian-bicycle.svg?url'
import railUrl from '@/assets/icons/modes/rail.svg?url'

const URLS = {
  'Commercial Trucks': truckUrl,
  Buses: busUrl,
  'Pedestrians/ Bicyclists': pedUrl,
  'Passenger Vehicles': pvUrl,
  Railcars: railUrl,
}

export const MODE_HAS_ICON = (mode) => mode in URLS

// Per-mode size boost. The pedestrian/bicyclist SVG has a wide ~1.92:1 viewBox,
// so when fit into a square box its content only occupies ~52% of the height
// and reads as much smaller than the other icons. Scale it up to compensate.
const SIZE_BOOST = {
  'Pedestrians/ Bicyclists': 1.7,
}

export default function ModeIcon({ mode, size = 18, className = '', title }) {
  const url = URLS[mode]
  if (!url) return null
  const boost = SIZE_BOOST[mode] || 1
  const rendered = size * boost
  const maskUrl = `url(${url})`
  return (
    <span
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={`inline-block flex-shrink-0 align-middle ${className}`}
      style={{
        width: rendered,
        height: rendered,
        backgroundColor: 'currentColor',
        WebkitMaskImage: maskUrl,
        maskImage: maskUrl,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  )
}

/**
 * Pre-built iconMap keyed by canonical mode name, matching the shape expected
 * by FilterRadioGroup / FilterMultiSelect / FilterCheckboxGroup. Each value is
 * a component that forwards `size` / `className` / `title` to ModeIcon.
 */
export const MODE_ICON_MAP = Object.fromEntries(
  Object.keys(URLS).map((mode) => [
    mode,
    function BoundModeIcon(props) {
      return <ModeIcon mode={mode} {...props} />
    },
  ]),
)
