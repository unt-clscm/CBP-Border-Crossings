/**
 * BarChart — Vertical or horizontal bar chart rendered with D3 into an SVG.
 *
 * ── BOILERPLATE: NO CHANGES NEEDED ─────────────────────────────────────────
 * Chart components are data-agnostic — they render whatever data array is
 * passed via props. When swapping datasets, update the page components
 * (src/pages/) that prepare and pass data to these charts, not the charts
 * themselves. The only reason to modify a chart is to change its visual
 * style or add new interactive features.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * WHAT IT DOES
 * Renders a simple bar chart that can be oriented either vertically (default)
 * or horizontally. Supports optional bar-click selection (highlight one bar,
 * dim the rest), animated entrance transitions, and automatic label
 * truncation / rotation when labels don't fit.
 *
 * PROPS
 * @param {Array<Object>} data
 *   Array of plain objects. Each object must contain at least the keys
 *   specified by `xKey` (category label) and `yKey` (numeric value).
 *   Example: [{ label: 'Trucks', value: 42000000 }, ...]
 *
 * @param {string} [xKey='label']
 *   Property name used for the category axis (x-axis in vertical mode,
 *   y-axis in horizontal mode).
 *
 * @param {string} [yKey='value']
 *   Property name used for the value axis.
 *
 * @param {string} [color=CHART_COLORS[0]]
 *   Fill color for bars. When a bar is not selected, it's rendered with
 *   25% opacity (`${color}40`).
 *
 * @param {Function} [colorAccessor]
 *   Optional function `(d) => colorString` returning a fill color per datum.
 *   When provided, overrides the uniform `color` prop for individual bars.
 *
 * @param {boolean} [horizontal=false]
 *   If true, bars grow left-to-right and labels appear on the y-axis.
 *   If false, bars grow bottom-to-top with labels on the x-axis.
 *
 * @param {Function} [formatValue=formatCurrency]
 *   Formatter for value labels shown on or above each bar.
 *
 * @param {Function} [onBarClick]
 *   Optional callback invoked with the clicked datum. Used together with
 *   `selectedBar` for click-to-filter interactions.
 *
 * @param {string} [selectedBar]
 *   Value of `xKey` for the currently selected bar. Non-selected bars are
 *   dimmed. Pass `null`/`undefined` to show all bars at full opacity.
 *
 * @param {number} [maxBars=15]
 *   Maximum number of bars displayed. Data beyond this limit is sliced off.
 *   NOTE: This is a visual cap — the parent should pre-sort data by
 *   importance/value so the most meaningful items appear first.
 *
 * @param {boolean} [animate=true]
 *   Whether bars animate in on first render (600ms staggered transition).
 *
 * @param {Array<Object>} [texasOverlay]
 *   Optional array of { [xKey]: label, texasValue: number } objects.
 *   When provided, draws a white diagonal hatch pattern over each bar
 *   proportional to the Texas share (texasValue / bar value).
 *
 * EDGE CASES & LIMITATIONS
 * - If `data` is empty or container width is 0, nothing renders.
 * - Labels longer than 20 characters are truncated with an ellipsis in
 *   vertical mode; in horizontal mode they're truncated to fit the
 *   available left margin.
 * - Vertical x-axis labels auto-rotate -35deg when they'd overlap.
 * - The component sets a `minHeight` on the container in horizontal mode
 *   to ensure each bar gets ~32px of vertical space.
 */
import React, { useRef, useEffect } from 'react'
import * as d3 from 'd3'
import { useChartResize, getResponsiveFontSize } from '@/lib/useChartResize'
import { CHART_COLORS, formatCompact } from '@/lib/chartColors'

/** Half-length of axis tick marks (extends TICK_HALF px above and below the axis line). */
const TICK_HALF = 5

function BarChart({
  data = [],
  xKey = 'label',
  yKey = 'value',
  color = CHART_COLORS[0],
  colorAccessor,
  horizontal = false,
  formatValue = formatCompact,
  labelAccessor,
  onBarClick,
  selectedBar,
  maxBars = 15,
  animate = true,
  texasOverlay,
}) {
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const tooltipRef = useRef(null)
  const { width, height: containerHeight, isFullscreen } = useChartResize(containerRef)

  useEffect(() => {
    if (!data.length || !width) return

    /** Resolve fill color for a datum, respecting colorAccessor and selection dimming. */
    const barFill = (d) => {
      const c = colorAccessor ? colorAccessor(d) : color
      return selectedBar && d[xKey] !== selectedBar ? `${c}40` : c
    }

    const FS = getResponsiveFontSize(width, isFullscreen)
    const charW = FS * 0.55

    // Enforce maxBars cap — only the first `maxBars` items are rendered.
    const displayData = data.slice(0, maxBars)
    const maxLabelLen = d3.max(displayData, (d) => (d[xKey] || '').length) || 0
    const dynamicLeft = horizontal
      ? Math.min(width * 0.5, Math.max(100, maxLabelLen * charW + 20))
      : 16
    // Estimate if vertical labels need rotation (before scale is built)
    const approxBandwidth = horizontal ? 0 : (width - 32) / displayData.length * 0.7
    const vLabelRotated = !horizontal && maxLabelLen * 9 > approxBandwidth
    const margin = horizontal
      ? { top: 8, right: 48, bottom: 24, left: dynamicLeft }
      : { top: 24, right: 12, bottom: vLabelRotated ? 100 : 48, left: 12 }

    const defaultH = horizontal ? Math.max(220, displayData.length * 32 + margin.top + margin.bottom) : 320
    // Use computed default height in normal mode to prevent feedback loops
    // where h-full containers in CSS grids cause unbounded SVG growth.
    // In fullscreen mode, fill the available container height.
    const height = horizontal
      ? defaultH
      : isFullscreen
        ? Math.max(defaultH, containerHeight > 100 ? containerHeight : defaultH)
        : defaultH
    const innerW = Math.max(1, width - margin.left - margin.right)
    const innerH = Math.max(1, height - margin.top - margin.bottom)

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', height)

    // Texas hatch overlay defs (if texasOverlay provided)
    const txMap = texasOverlay ? new Map(texasOverlay.map((d) => [d[xKey], d.texasValue])) : null
    if (txMap && txMap.size) {
      const defs = svg.append('defs')
      const patId = `bar-hatch-tx-${Math.random().toString(36).slice(2, 8)}`
      svg.node().__hatchId = patId
      defs.append('pattern')
        .attr('id', patId)
        .attr('patternUnits', 'userSpaceOnUse')
        .attr('width', 8)
        .attr('height', 8)
        .append('path')
        .attr('d', 'M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 3)
        .attr('stroke-opacity', 0.42)
    }

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    if (horizontal) {
      const x = d3.scaleLinear()
        .domain([0, d3.max(displayData, (d) => d[yKey]) || 1])
        .range([0, innerW])

      const y = d3.scaleBand()
        .domain(displayData.map((d) => d[xKey]))
        .range([0, innerH])
        .padding(0.3)

      // Y-axis line
      g.append('line')
        .attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', innerH)
        .attr('stroke', '#9ca3af')

      // X-axis line
      g.append('line')
        .attr('x1', 0).attr('x2', innerW).attr('y1', innerH).attr('y2', innerH)
        .attr('stroke', '#9ca3af')

      // Bars
      g.selectAll('.bar').data(displayData).enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('y', (d) => y(d[xKey]))
        .attr('height', y.bandwidth())
        .attr('x', 0)
        .attr('rx', 3)
        .attr('fill', barFill)
        .attr('cursor', onBarClick ? 'pointer' : 'default')
        .attr('width', 0)
        .on('click', (e, d) => onBarClick?.(d))
        .transition()
        .duration(animate ? 600 : 0)
        .delay((d, i) => (animate ? i * 30 : 0))
        .attr('width', (d) => x(d[yKey]))

      // Value labels — inside bar if it would overflow, outside otherwise
      const rightMarginPx = margin.right
      g.selectAll('.val-label').data(displayData).enter()
        .append('text')
        .attr('y', (d) => y(d[xKey]) + y.bandwidth() / 2)
        .attr('dy', '0.35em')
        .attr('font-size', `${FS}px`)
        .each(function (d) {
          const barW = x(d[yKey])
          const labelText = labelAccessor ? labelAccessor(d) : formatValue(d[yKey])
          const labelW = labelText.length * charW // approx char width
          const overflows = barW + labelW + 8 > innerW + rightMarginPx
          d3.select(this)
            .attr('x', overflows ? barW - 8 : barW + 4)
            .attr('text-anchor', overflows ? 'end' : 'start')
            .attr('fill', overflows ? 'white' : 'var(--color-text-secondary)')
            .attr('font-weight', overflows ? '600' : 'normal')
            .text(labelText)
        })
        .attr('opacity', 0)
        .transition()
        .delay(animate ? 400 : 0)
        .duration(300)
        .attr('opacity', 1)

      // Texas hatch overlay on horizontal bars
      if (txMap && txMap.size) {
        const patId = svg.node().__hatchId
        displayData.forEach((d) => {
          const txVal = txMap.get(d[xKey])
          if (!txVal || txVal <= 0) return
          const barW = x(d[yKey])
          const share = Math.min(txVal / d[yKey], 1)
          g.append('rect')
            .attr('x', 0)
            .attr('y', y(d[xKey]))
            .attr('width', 0)
            .attr('height', y.bandwidth())
            .attr('rx', 3)
            .attr('fill', `url(#${patId})`)
            .attr('pointer-events', 'none')
            .transition()
            .duration(animate ? 600 : 0)
            .attr('width', barW * share)
        })
      }

      // Y Axis (centered tick marks)
      const yAxisH = g.append('g')
        .call(d3.axisLeft(y).tickSize(0))
      yAxisH.select('.domain').remove()
      yAxisH.selectAll('.tick').append('line')
        .attr('x1', -TICK_HALF).attr('x2', 0)
        .attr('stroke', '#9ca3af')
      // Fit labels: shrink font or truncate only if needed
      const labelSpace = dynamicLeft - 20 // available px for label text
      const tooltip = tooltipRef.current
      yAxisH.selectAll('.tick text')
        .attr('fill', 'var(--color-text-secondary)')
        .attr('dx', '-0.4em')
        .each(function () {
          const fullText = d3.select(this).text()
          const fits = fullText.length * charW <= labelSpace
          d3.select(this).attr('font-size', `${FS}px`)
          if (!fits) {
            const maxChars = Math.floor(labelSpace / charW)
            d3.select(this).text(fullText.slice(0, maxChars - 1) + '…')
          }
          // Show HTML tooltip on hover with full label text
          d3.select(this)
            .style('cursor', !fits ? 'pointer' : null)
            .on('mouseover', function (_event) {
              if (!tooltip) return
              tooltip.textContent = fullText
              tooltip.style.opacity = '1'
              const containerRect = containerRef.current.getBoundingClientRect()
              const tickRect = this.getBoundingClientRect()
              tooltip.style.left = `${tickRect.right - containerRect.left + 8}px`
              tooltip.style.top = `${tickRect.top - containerRect.top + tickRect.height / 2}px`
              tooltip.style.transform = 'translateY(-50%)'
            })
            .on('mouseout', function () {
              if (!tooltip) return
              tooltip.style.opacity = '0'
            })
        })

    } else {
      const x = d3.scaleBand()
        .domain(displayData.map((d) => d[xKey]))
        .range([0, innerW])
        .padding(0.3)

      const y = d3.scaleLinear()
        .domain([0, d3.max(displayData, (d) => d[yKey]) || 1])
        .nice()
        .range([innerH, 0])

      // X-axis line
      g.append('line')
        .attr('x1', 0).attr('x2', innerW).attr('y1', innerH).attr('y2', innerH)
        .attr('stroke', '#9ca3af')

      // Bars
      g.selectAll('.bar').data(displayData).enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', (d) => x(d[xKey]))
        .attr('width', x.bandwidth())
        .attr('rx', 3)
        .attr('fill', barFill)
        .attr('cursor', onBarClick ? 'pointer' : 'default')
        .attr('y', innerH)
        .attr('height', 0)
        .on('click', (e, d) => onBarClick?.(d))
        .transition()
        .duration(animate ? 600 : 0)
        .delay((d, i) => (animate ? i * 30 : 0))
        .attr('y', (d) => y(d[yKey]))
        .attr('height', (d) => innerH - y(d[yKey]))

      // Value labels above each bar
      g.selectAll('.val-label').data(displayData).enter()
        .append('text')
        .attr('x', (d) => x(d[xKey]) + x.bandwidth() / 2)
        .attr('text-anchor', 'middle')
        .attr('font-size', `${FS}px`)
        .attr('fill', 'var(--color-text-secondary)')
        .text((d) => labelAccessor ? labelAccessor(d) : formatValue(d[yKey]))
        .attr('y', innerH)
        .attr('opacity', 0)
        .transition()
        .duration(animate ? 600 : 0)
        .delay((d, i) => (animate ? i * 30 : 0))
        .attr('y', (d) => y(d[yKey]) - 6)
        .attr('opacity', 1)

      // Texas hatch overlay on vertical bars
      if (txMap && txMap.size) {
        const patId = svg.node().__hatchId
        displayData.forEach((d) => {
          const txVal = txMap.get(d[xKey])
          if (!txVal || txVal <= 0) return
          const barH = innerH - y(d[yKey])
          const share = Math.min(txVal / d[yKey], 1)
          g.append('rect')
            .attr('x', x(d[xKey]))
            .attr('y', y(d[yKey]) + barH * (1 - share))
            .attr('width', x.bandwidth())
            .attr('height', 0)
            .attr('rx', 3)
            .attr('fill', `url(#${patId})`)
            .attr('pointer-events', 'none')
            .transition()
            .duration(animate ? 600 : 0)
            .attr('height', barH * share)
        })
      }

      // X Axis (tick marks only below axis)
      const xAxisV = g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(x).tickSize(0))
      xAxisV.select('.domain').remove()
      xAxisV.selectAll('.tick').append('line')
        .attr('y1', 0).attr('y2', TICK_HALF)
        .attr('stroke', '#9ca3af')
      // Check if any label needs rotation
      const longestLabel = d3.max(displayData, (d) => (d[xKey] || '').length) || 0
      const needsRotation = longestLabel * charW > x.bandwidth()

      const tooltipV = tooltipRef.current
      xAxisV.selectAll('.tick text')
        .attr('font-size', `${FS}px`)
        .attr('fill', 'var(--color-text-secondary)')
        .attr('dy', needsRotation ? '0.5em' : '1.2em')
        .attr('dx', needsRotation ? '-0.5em' : null)
        .attr('transform', needsRotation ? 'rotate(-35)' : null)
        .attr('text-anchor', needsRotation ? 'end' : 'middle')
        .each(function () {
          const fullText = d3.select(this).text()
          const truncated = fullText.length > 20
          if (truncated) d3.select(this).text(fullText.slice(0, 18) + '…')
          // Show HTML tooltip on hover with full label text
          d3.select(this)
            .style('cursor', truncated ? 'pointer' : null)
            .on('mouseover', function () {
              if (!tooltipV) return
              tooltipV.textContent = fullText
              tooltipV.style.opacity = '1'
              const containerRect = containerRef.current.getBoundingClientRect()
              const tickRect = this.getBoundingClientRect()
              tooltipV.style.left = `${tickRect.left - containerRect.left + tickRect.width / 2}px`
              tooltipV.style.top = `${tickRect.top - containerRect.top - 8}px`
              tooltipV.style.transform = 'translate(-50%, -100%)'
            })
            .on('mouseout', function () {
              if (!tooltipV) return
              tooltipV.style.opacity = '0'
            })
        })
    }

  }, [data, width, containerHeight, isFullscreen, xKey, yKey, color, colorAccessor, horizontal, selectedBar, maxBars, animate, labelAccessor, formatValue, onBarClick, texasOverlay])

  // In horizontal mode, set a minimum height so each bar gets enough space
  // (~32px per bar). This allows the parent grid cell to grow accordingly.
  const displayCount = Math.min(data.length, maxBars)
  const minH = horizontal ? Math.max(220, displayCount * 32 + 32) : undefined

  return (
    <div ref={containerRef} className="w-full h-full relative" style={{ minHeight: minH }}>
      <svg ref={svgRef} className="w-full" role="img" aria-label={`${horizontal ? 'Horizontal bar' : 'Bar'} chart visualization`} />
      <div
        ref={tooltipRef}
        role="tooltip"
        style={{
          position: 'absolute',
          pointerEvents: 'none',
          opacity: 0,
          transition: 'opacity 0.15s',
          background: '#1f2937',
          color: '#fff',
          padding: '6px 10px',
          borderRadius: '6px',
          fontSize: '14px',
          lineHeight: '1.3',
          maxWidth: '320px',
          whiteSpace: 'normal',
          zIndex: 50,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}
      />
    </div>
  )
}

export default React.memo(BarChart)
