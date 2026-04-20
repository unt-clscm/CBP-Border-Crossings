/**
 * StatCard.jsx — KPI metric card with trend indicator
 * ----------------------------------------------------
 * Displays a single key performance indicator (KPI) as a styled card with:
 *   - A label (uppercase, smaller text)
 *   - A large formatted value
 *   - An optional trend indicator (up / down / neutral) with an icon and label
 *   - An optional decorative icon in the top-right corner
 *
 * Variants & Highlighting
 *   The card supports visual hierarchy through two mechanisms:
 *   - `highlight` (boolean) — When true, the card uses a blue gradient background
 *     with white text instead of the default white card style.
 *   - `variant` ('primary' | 'secondary' | 'default') — When combined with highlight:
 *       - 'primary'   → Dark gradient (for the lead/hero KPI card)
 *       - other       → Lighter gradient with a subtle white border (supporting cards)
 *   - Without highlight, the card is white with a light border.
 *
 * Trend Colors
 *   - 'up'      → Green (brand-green)
 *   - 'down'    → Red (brand-red)
 *   - 'neutral' → Gray (text-secondary)
 *
 * Props
 *   @param {string}       label      — KPI label text (e.g. "Total Trade Value")
 *   @param {string|React} value      — Formatted display value (e.g. "$1.2B")
 *   @param {'up'|'down'|'neutral'} [trend] — Direction for the trend icon
 *   @param {string}      [trendLabel] — Text next to the trend icon (e.g. "+5.2% YoY")
 *   @param {boolean}     [highlight=false] — Use gradient background
 *   @param {string}      [variant='default'] — 'primary' for lead card dark gradient
 *   @param {Component}   [icon]      — Lucide icon component for the corner badge
 *   @param {number}      [delay=0]   — CSS animation delay in ms (for staggered fade-up)
 *
 * BOILERPLATE NOTE:
 *   This component is data-agnostic. When adapting for a new project, change the
 *   label text, value formatting, and trend calculations in the PAGE components
 *   that use StatCard — not here. This file does not need modification.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

/**
 * Animated counter hook — animates a numeric value from 0 to target.
 * Extracts the leading number from a formatted string (e.g. "11.0M" → 11.0)
 * and interpolates it while preserving the suffix.
 */
function useCountUp(displayValue, duration = 1200, startDelay = 0) {
  const rafRef = useRef(null)
  const [shown, setShown] = useState(displayValue)

  useEffect(() => {
    if (typeof displayValue !== 'string') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(displayValue)
      return
    }

    // Parse leading number and suffix from formatted string
    const match = displayValue.match(/^([^0-9]*)([\d,.]+)(.*)$/)
    if (!match) {
      setShown(displayValue)
      return
    }

    const [, prefix, numStr, suffix] = match
    const target = parseFloat(numStr.replace(/,/g, ''))
    if (isNaN(target) || target === 0) {
      setShown(displayValue)
      return
    }

    // Count decimal places to preserve formatting
    const decimalMatch = numStr.match(/\.(\d+)/)
    const decimals = decimalMatch ? decimalMatch[1].length : 0
    const useCommas = numStr.includes(',')

    // Start from 0
    setShown(`${prefix}${(0).toFixed(decimals)}${suffix}`)

    // Delay the count-up so it starts AFTER the card's fade-up CSS animation
    // completes (500ms base + stagger delay). The 50ms extra ensures the zero
    // value renders first. This also survives React strict mode's double-mount.
    const timerId = setTimeout(() => {
      const start = performance.now()
      const animate = (now) => {
        const elapsed = now - start
        const progress = Math.min(elapsed / duration, 1)
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3)
        const current = target * eased
        let formatted = current.toFixed(decimals)
        if (useCommas) {
          const [intPart, decPart] = formatted.split('.')
          formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (decPart ? '.' + decPart : '')
        }
        setShown(`${prefix}${formatted}${suffix}`)
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate)
        }
      }
      rafRef.current = requestAnimationFrame(animate)
    }, startDelay + 50)

    return () => {
      clearTimeout(timerId)
      cancelAnimationFrame(rafRef.current)
    }
  }, [displayValue, duration, startDelay])

  return shown
}

/** Tiny inline sparkline SVG — takes an array of numbers and renders a miniature trend line. */
function Sparkline({ data, highlight, width = 64, height = 20 }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 2) - 1
    return `${x},${y}`
  }).join(' ')
  const color = highlight ? 'rgba(255,255,255,0.6)' : '#93c5fd'
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="inline-block ml-2 align-middle">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function StatCard({
  label,
  value,
  title,
  trend,
  trendLabel,
  sparkline,
  highlight = false,
  variant = 'default',
  icon: Icon,
  delay = 0,
}) {
  // Start count-up after the fade-up animation completes (500ms base + stagger delay)
  const animatedValue = useCountUp(typeof value === 'string' ? value : null, 1200, 500 + delay)
  const tooltipRef = useRef(null)
  const cardRef = useRef(null)

  // Clamp tooltip so it doesn't overflow the viewport
  const clampTooltip = useCallback(() => {
    const tip = tooltipRef.current
    if (!tip) return
    // Reset any previous adjustment
    tip.style.left = '50%'
    tip.style.transform = 'translateX(-50%)'
    const rect = tip.getBoundingClientRect()
    const pad = 8
    if (rect.left < pad) {
      const shift = pad - rect.left
      tip.style.transform = `translateX(calc(-50% + ${shift}px))`
    } else if (rect.right > window.innerWidth - pad) {
      const shift = rect.right - (window.innerWidth - pad)
      tip.style.transform = `translateX(calc(-50% - ${shift}px))`
    }
  }, [])

  const trendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const TrendIcon = trendIcon
  const trendColor =
    trend === 'up'
      ? 'text-brand-green'
      : trend === 'down'
      ? 'text-brand-red'
      : 'text-text-secondary'

  // highlight + primary = dark gradient (lead card)
  // highlight + default/secondary = lighter gradient (supporting cards)
  // no highlight = white card
  const cardClass = highlight
    ? variant === 'primary'
      ? 'gradient-blue text-white shadow-lg'
      : 'gradient-blue-light text-white shadow-lg border border-white/35'
    : 'bg-white border border-border-light shadow-xs hover:shadow-md'

  return (
    <div
      ref={cardRef}
      className={`group rounded-xl p-5 transition-all duration-300 animate-fade-up row-span-3 grid grid-rows-subgrid gap-y-0 relative hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue ${cardClass}`}
      style={{ animationDelay: `${delay}ms` }}
      onMouseEnter={clampTooltip}
      onFocus={clampTooltip}
      {...(title ? { tabIndex: 0, role: 'group', 'aria-label': `${label}: ${typeof value === 'string' ? value : ''}${trendLabel ? `, ${trendLabel}` : ''}. ${title}` } : {})}
    >
      {/* Row 1 — label */}
      <p
        className={`text-base font-medium uppercase tracking-wider mb-2 pr-10 ${
          highlight ? 'text-white/70' : 'text-text-secondary'
        }`}
      >
        {label}
      </p>
      {/* Row 2 — value + sparkline (pinned to bottom of its row) */}
      <div className="flex items-end gap-1 self-end">
        <p
          className={`text-2xl md:text-3xl font-bold leading-none tracking-tight whitespace-nowrap ${
            highlight ? 'text-white' : 'text-text-primary'
          }`}
        >
          {typeof value === 'string' ? animatedValue : value}
        </p>
        {sparkline && <Sparkline data={sparkline} highlight={highlight} />}
      </div>
      {/* Row 3 — trend (sized to tallest trend across sibling cards) */}
      <div>
        {trendLabel && (
          <div className={`flex items-center gap-1 mt-2 text-base font-medium ${
            highlight ? 'text-white/80' : trendColor
          }`}>
            <TrendIcon size={14} />
            <span>{trendLabel}</span>
          </div>
        )}
      </div>
      {/* Icon badge — absolutely positioned top-right */}
      {Icon && (
        <div
          className={`absolute top-5 right-5 p-2 rounded-lg ${
            highlight ? 'bg-white/10' : 'bg-surface-alt'
          }`}
        >
          <Icon
            size={20}
            className={highlight ? 'text-white/80' : 'text-brand-blue'}
          />
        </div>
      )}
      {/* Tooltip — shown on hover or focus-within when title is provided */}
      {title && (
        <div ref={tooltipRef} className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 z-50">
          <div className="bg-gray-900 text-white text-sm rounded-lg px-3 py-2 whitespace-nowrap shadow-lg max-w-[90vw]">
            {title}
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-gray-900" />
        </div>
      )}
    </div>
  )
}
