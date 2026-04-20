/**
 * ShareDonut — Single-value gauge donut.
 *
 * Renders a ring where the filled arc length represents a share (0..1) of
 * some total. The center text shows the share as a percentage; a label and
 * formatted absolute value are rendered underneath.
 *
 * Used by ByMode to show each crossing's contribution to its mode's total
 * as a small multiple — five mode rows × N crossings per row.
 */
import React from 'react'

function ShareDonut({
  share = 0,
  label,
  value,
  formatValue = (v) => String(v),
  color = '#0056a9',
  size = 92,
  strokeWidth = 10,
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(share) ? share : 0))
  const r  = (size - strokeWidth) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const dashOffset = circumference * (1 - clamped)
  const percent = clamped * 100
  let percentText
  if (percent === 0) percentText = '0%'
  else if (percent < 0.1) percentText = '<0.1%'
  else if (percent < 10) percentText = `${percent.toFixed(1)}%`
  else percentText = `${percent.toFixed(1)}%`
  const percentFont = percentText.length > 5 ? 0.18 : 0.22

  // Fixed-width cell so donuts align in a grid and long names get room to
  // break across two lines before being clipped.
  const cellWidth = size + 60

  return (
    <div
      className="flex flex-col items-center gap-1.5 flex-shrink-0"
      style={{ width: cellWidth }}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${percentText}`}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap={clamped > 0 && clamped < 1 ? 'round' : 'butt'}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center font-semibold text-text-primary"
          style={{ fontSize: Math.round(size * percentFont) }}
        >
          {percentText}
        </div>
      </div>
      <div
        className="text-xs font-medium text-text-primary leading-tight text-center w-full px-1"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          wordBreak: 'break-word',
        }}
        title={label}
      >
        {label}
      </div>
      <div className="text-[11px] text-text-secondary leading-tight">
        {formatValue(value)}
      </div>
    </div>
  )
}

export default React.memo(ShareDonut)
