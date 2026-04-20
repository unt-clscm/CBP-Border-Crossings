/**
 * StackedBarChart — Vertical stacked bar chart using D3's stack layout.
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
 * Renders a grouped/stacked vertical bar chart. Each bar column represents
 * one x-axis category (e.g. a year), and the stacked layers within each
 * column represent the `stackKeys` categories (e.g. trade modes).
 *
 * Hovering a column highlights it and shows an HTML tooltip with a
 * per-layer breakdown and total. The tooltip is built with safe DOM APIs
 * (no innerHTML) to prevent XSS from data values.
 *
 * DATA FORMAT
 * The `data` array must be "wide-format" — one object per x-category, with
 * each `stackKeys` value as a numeric property:
 *   [
 *     { year: 2020, Truck: 5000000, Rail: 3000000, Air: 200000 },
 *     { year: 2021, Truck: 5500000, Rail: 3100000, Air: 250000 },
 *   ]
 * IMPORTANT: Every key listed in `stackKeys` MUST exist as a property on
 * each data object. Missing keys are treated as 0 by D3's stack, but this
 * can produce misleading visuals — ensure the parent page fills gaps.
 *
 * PROPS
 * @param {Array<Object>} data
 *   Wide-format array (see DATA FORMAT above).
 *
 * @param {string} [xKey='year']
 *   Property name for the x-axis (category axis).
 *
 * @param {string[]} stackKeys
 *   Array of property names that form the stacked layers. Order determines
 *   stacking order — first key is the bottom layer.
 *
 * @param {Function} [formatValue=formatCurrency]
 *   Formatter for tooltip values and y-axis labels.
 *
 * @param {boolean} [animate=true]
 *   Whether bars animate in with a staggered grow-up transition.
 *
 * EDGE CASES & LIMITATIONS
 * - If `data`, `stackKeys`, or the container width is empty/zero, nothing
 *   renders (early return).
 * - Only the topmost bar layer gets rounded corners (rx=3).
 * - X-axis labels are always rotated -35deg — works well for years and
 *   short category names. Very long labels will be clipped.
 * - The tooltip shows layers in reverse stack order (top-of-stack first)
 *   and filters out layers with value 0.
 */
import React, { useRef, useEffect } from 'react'
import * as d3 from 'd3'
import { useChartResize, getResponsiveFontSize } from '@/lib/useChartResize'
import { CHART_COLORS, formatCompact } from '@/lib/chartColors'

function StackedBarChart({
  data = [],
  xKey = 'year',
  stackKeys = [],
  formatValue = formatCompact,
  animate = true,
  normalize = false,
  overlayData = [],
  overlayLabel = 'Texas',
  overlayColor = '#BF5700',
}) {
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const tipIdRef = useRef(`stacked-bar-tooltip-${Math.random().toString(36).slice(2, 9)}`)
  const { width, height: containerHeight, isFullscreen } = useChartResize(containerRef)

  useEffect(() => {
    if (!data.length || !width || !stackKeys.length) return

    const FS = getResponsiveFontSize(width, isFullscreen)

    // When normalize=true, convert each row so stackKeys sum to 100%
    const chartData = normalize
      ? data.map((d) => {
          const total = stackKeys.reduce((s, k) => s + (d[k] || 0), 0)
          const row = { ...d }
          if (total > 0) stackKeys.forEach((k) => { row[k] = (d[k] || 0) / total * 100 })
          else stackKeys.forEach((k) => { row[k] = 0 })
          return row
        })
      : data
    const pctFmt = (v) => `${v.toFixed(1)}%`

    // Dynamic left margin: measure the longest Y-axis label to prevent clipping
    const stackEst = d3.stack().keys(stackKeys)(chartData)
    const yMaxEst = d3.max(stackEst, (layer) => d3.max(layer, (d) => d[1])) || 1
    const yTicksEst = d3.scaleLinear().domain([0, normalize ? 100 : yMaxEst]).nice().ticks(5)
    const yLabelFmt = normalize ? pctFmt : formatValue
    const maxYLabelLen = d3.max(yTicksEst, (v) => (v === 0 ? '' : yLabelFmt(v)).length) || 4
    const dynamicLeft = Math.max(48, maxYLabelLen * (FS * 0.6) + 16)

    // Estimate bottom margin based on longest x-label (longer labels need more room when rotated)
    const maxXLabelLen = d3.max(chartData, (d) => String(d[xKey]).length) || 4
    const dynamicBottom = maxXLabelLen > 6
      ? Math.max(56, maxXLabelLen * (FS * 0.45) + 30)
      : 56
    const margin = isFullscreen
      ? { top: 16, right: 20, bottom: Math.max(68, dynamicBottom + 12), left: Math.max(100, dynamicLeft) }
      : { top: 12, right: 12, bottom: dynamicBottom, left: dynamicLeft }

    // Pre-calculate legend rows
    const LEGEND_FONT = FS
    const LEGEND_CHAR_W = LEGEND_FONT * 0.55
    const LEGEND_DOT_R = 6
    const LEGEND_GAP = 28
    const availLegendW = width - margin.left - margin.right
    let legendRows = 1
    let tmpOff = 0
    stackKeys.forEach((key) => {
      const itemW = LEGEND_DOT_R * 2 + 10 + key.length * LEGEND_CHAR_W + LEGEND_GAP
      if (tmpOff + itemW > availLegendW && tmpOff > 0) { legendRows++; tmpOff = 0 }
      tmpOff += itemW
    })
    const hasOverlay = overlayData.length > 0 && !normalize
    const overlayAnnotH = hasOverlay ? 24 : 0
    const legendSpace = 16 + legendRows * 28 + overlayAnnotH

    const defaultH = 320 + legendSpace
    // Use computed default height in normal mode to prevent feedback loops
    // in CSS grid layouts. In fullscreen mode, fill available space.
    const height = isFullscreen
      ? Math.max(defaultH, containerHeight > 100 ? containerHeight : defaultH)
      : defaultH
    const innerW = Math.max(1, width - margin.left - margin.right)
    const innerH = Math.max(1, height - margin.top - margin.bottom - legendSpace)

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', height)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const colorScale = d3.scaleOrdinal().domain(stackKeys).range(CHART_COLORS)

    // D3 stack layout: converts the wide-format data into layer arrays.
    // Each layer contains [y0, y1] pairs per data point (cumulative ranges).
    const stack = d3.stack().keys(stackKeys)
    const stacked = stack(chartData)

    const x = d3.scaleBand()
      .domain(chartData.map((d) => d[xKey]))
      .range([0, innerW])
      .padding(0.25)

    const y = d3.scaleLinear()
      .domain([0, normalize ? 100 : (d3.max(stacked, (layer) => d3.max(layer, (d) => d[1])) || 1)])
      .nice()
      .range([innerH, 0])

    const TICK_HALF = 5

    // Horizontal grid lines (skip zero)
    const yGridTicks = y.ticks(5).filter((t) => t !== 0)
    g.append('g').selectAll('line').data(yGridTicks).enter()
      .append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', (d) => y(d)).attr('y2', (d) => y(d))
      .attr('stroke', '#9ca3af').attr('stroke-dasharray', '4,4')

    // Vertical grid lines (at bar centers)
    g.append('g').selectAll('line').data(data).enter()
      .append('line')
      .attr('x1', (d) => x(d[xKey]) + x.bandwidth() / 2)
      .attr('x2', (d) => x(d[xKey]) + x.bandwidth() / 2)
      .attr('y1', 0).attr('y2', innerH)
      .attr('stroke', '#9ca3af').attr('stroke-dasharray', '4,4')

    // Axis lines
    g.append('line')
      .attr('x1', 0).attr('x2', innerW).attr('y1', innerH).attr('y2', innerH)
      .attr('stroke', '#9ca3af')
    g.append('line')
      .attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', innerH)
      .attr('stroke', '#9ca3af')

    // Build overlay lookup: xKey → { mode1: val, mode2: val, ... }
    const overlayMap = hasOverlay
      ? new Map(overlayData.map((d) => [d[xKey], d]))
      : null

    // Render each stacked layer as a set of rects. Only the topmost layer
    // (last in the array) gets rounded corners so the bar column looks clean.
    // When overlay is active, main bars render at reduced opacity.
    const mainOpacity = hasOverlay ? 0.30 : 1
    stacked.forEach((layer, li) => {
      g.selectAll(`.bar-${li}`).data(layer).enter()
        .append('rect')
        .attr('class', `bar-layer bar-layer-${li}`)
        .attr('x', (d) => x(d.data[xKey]))
        .attr('width', x.bandwidth())
        .attr('rx', li === stacked.length - 1 ? 3 : 0)
        .attr('fill', colorScale(layer.key))
        .attr('opacity', mainOpacity)
        .attr('y', innerH)
        .attr('height', 0)
        .transition()
        .duration(animate ? 600 : 0)
        .delay((d, i) => (animate ? i * 20 + li * 100 : 0))
        .attr('y', (d) => y(d[1]))
        .attr('height', (d) => y(d[0]) - y(d[1]))
    })

    // ── Overlay bars (e.g. Texas share within each US mode segment) ──
    if (hasOverlay) {
      stacked.forEach((layer, li) => {
        g.selectAll(`.overlay-bar-${li}`).data(layer).enter()
          .append('rect')
          .attr('class', `overlay-layer overlay-layer-${li}`)
          .attr('x', (d) => x(d.data[xKey]))
          .attr('width', x.bandwidth())
          .attr('rx', 0)
          .attr('fill', colorScale(layer.key))
          .attr('y', innerH)
          .attr('height', 0)
          .transition()
          .duration(animate ? 600 : 0)
          .delay((d, i) => (animate ? i * 20 + li * 100 : 0))
          .attr('y', (d) => {
            const oRow = overlayMap.get(d.data[xKey])
            const oVal = oRow ? (oRow[layer.key] || 0) : 0
            const usVal = d.data[layer.key] || 0
            const segH = y(d[0]) - y(d[1])
            const ratio = usVal > 0 ? Math.min(oVal / usVal, 1) : 0
            return y(d[0]) - segH * ratio
          })
          .attr('height', (d) => {
            const oRow = overlayMap.get(d.data[xKey])
            const oVal = oRow ? (oRow[layer.key] || 0) : 0
            const usVal = d.data[layer.key] || 0
            const segH = y(d[0]) - y(d[1])
            const ratio = usVal > 0 ? Math.min(oVal / usVal, 1) : 0
            return segH * ratio
          })

        // Burnt-orange divider line at the top edge of each overlay segment
        g.selectAll(`.overlay-divider-${li}`).data(layer).enter()
          .append('line')
          .attr('class', 'overlay-divider')
          .attr('x1', (d) => x(d.data[xKey]))
          .attr('x2', (d) => x(d.data[xKey]) + x.bandwidth())
          .attr('stroke', overlayColor)
          .attr('stroke-width', 1.5)
          .attr('opacity', 0)
          .transition()
          .duration(animate ? 600 : 0)
          .delay((d, i) => (animate ? i * 20 + li * 100 : 0))
          .attr('opacity', (d) => {
            const oRow = overlayMap.get(d.data[xKey])
            const oVal = oRow ? (oRow[layer.key] || 0) : 0
            const usVal = d.data[layer.key] || 0
            return (oVal > 0 && oVal < usVal) ? 1 : 0
          })
          .attr('y1', (d) => {
            const oRow = overlayMap.get(d.data[xKey])
            const oVal = oRow ? (oRow[layer.key] || 0) : 0
            const usVal = d.data[layer.key] || 0
            const segH = y(d[0]) - y(d[1])
            const ratio = usVal > 0 ? Math.min(oVal / usVal, 1) : 0
            return y(d[0]) - segH * ratio
          })
          .attr('y2', (d) => {
            const oRow = overlayMap.get(d.data[xKey])
            const oVal = oRow ? (oRow[layer.key] || 0) : 0
            const usVal = d.data[layer.key] || 0
            const segH = y(d[0]) - y(d[1])
            const ratio = usVal > 0 ? Math.min(oVal / usVal, 1) : 0
            return y(d[0]) - segH * ratio
          })
      })
    }

    // ── HTML Tooltip (fixed to viewport, escapes overflow-hidden) ──
    const tipId = tipIdRef.current
    let tipDiv = document.getElementById(tipId)
    if (!tipDiv) {
      tipDiv = document.createElement('div')
      tipDiv.id = tipId
      tipDiv.setAttribute('role', 'tooltip')
      Object.assign(tipDiv.style, {
        position: 'fixed', pointerEvents: 'none', display: 'none',
        background: 'white', border: '1px solid #e2e5e9', borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.10)', padding: '12px 14px',
        fontSize: '16px', lineHeight: '1.6', zIndex: '9999', whiteSpace: 'nowrap',
        fontFamily: 'inherit', color: '#333f48', maxWidth: hasOverlay ? '520px' : '360px',
      })
      document.body.appendChild(tipDiv)
    }

    // Invisible overlay rects spanning each bar column's full height.
    // These capture mouse events so the tooltip works even when hovering
    // between stacked layers or on the gap between bars.
    // Look up original (un-normalized) row by xKey for tooltip display
    const origMap = normalize ? new Map(data.map((d) => [d[xKey], d])) : null

    g.append('g').selectAll('.hover-col').data(chartData).enter()
      .append('rect')
      .attr('class', 'hover-col')
      .attr('x', (d) => x(d[xKey]))
      .attr('width', x.bandwidth())
      .attr('y', 0)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .on('mouseenter', function (_event, d) {
        tipDiv.style.display = 'block'
        const isActive = (bd) => bd.data[xKey] === d[xKey]
        g.selectAll('.bar-layer').attr('opacity', (bd) => isActive(bd) ? mainOpacity : mainOpacity * 0.3)
        if (hasOverlay) {
          g.selectAll('.overlay-layer').attr('opacity', (bd) => isActive(bd) ? 1 : 0.3)
        }
      })
      .on('mousemove', function (event, d) {
        const orig = origMap ? origMap.get(d[xKey]) : d
        const oRow = hasOverlay ? overlayMap.get(d[xKey]) : null
        // Build rows (top-of-stack first)
        const rows = [...stackKeys].reverse()
          .map((key) => ({
            name: key,
            pct: d[key] || 0,
            abs: (orig ? orig[key] : d[key]) || 0,
            color: colorScale(key),
            overlayVal: oRow ? (oRow[key] || 0) : 0,
          }))
          .filter((r) => (normalize ? r.abs > 0 : r.pct > 0))
        const totalAbs = rows.reduce((s, r) => s + r.abs, 0)
        const totalOverlay = hasOverlay ? rows.reduce((s, r) => s + r.overlayVal, 0) : 0

        // Build tooltip using safe DOM APIs — textContent and createElement
        // only. Never use innerHTML to prevent XSS from data values.
        tipDiv.textContent = ''
        const header = document.createElement('div')
        Object.assign(header.style, { fontWeight: '700', fontSize: '16px', marginBottom: '6px' })
        header.textContent = d[xKey]
        tipDiv.appendChild(header)

        const body = document.createElement('div')
        Object.assign(body.style, { borderTop: '1px solid #e5e7eb', paddingTop: '6px' })

        if (hasOverlay) {
          // Column headers for comparison tooltip
          const colHeader = document.createElement('div')
          Object.assign(colHeader.style, { display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '4px', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' })
          const colMode = document.createElement('span')
          colMode.textContent = 'Mode'
          const colRight = document.createElement('span')
          Object.assign(colRight.style, { display: 'flex', gap: '16px' })
          const colUS = document.createElement('span')
          colUS.textContent = 'U.S. Total'
          Object.assign(colUS.style, { width: '80px', textAlign: 'right' })
          const colTX = document.createElement('span')
          colTX.textContent = overlayLabel
          Object.assign(colTX.style, { width: '80px', textAlign: 'right' })
          const colPct = document.createElement('span')
          colPct.textContent = 'Share'
          Object.assign(colPct.style, { width: '44px', textAlign: 'right' })
          colRight.appendChild(colUS)
          colRight.appendChild(colTX)
          colRight.appendChild(colPct)
          colHeader.appendChild(colMode)
          colHeader.appendChild(colRight)
          body.appendChild(colHeader)
        }

        rows.forEach((r) => {
          const row = document.createElement('div')
          Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' })
          const left = document.createElement('span')
          Object.assign(left.style, { display: 'flex', alignItems: 'center', gap: '6px' })
          const dot = document.createElement('span')
          Object.assign(dot.style, { width: '10px', height: '10px', borderRadius: '50%', background: r.color, flexShrink: '0' })
          const labelSpan = document.createElement('span')
          labelSpan.style.color = '#6b7280'
          labelSpan.textContent = r.name
          left.appendChild(dot)
          left.appendChild(labelSpan)
          row.appendChild(left)

          if (hasOverlay) {
            const right = document.createElement('span')
            Object.assign(right.style, { display: 'flex', gap: '16px', alignItems: 'baseline' })
            const usSpan = document.createElement('span')
            Object.assign(usSpan.style, { fontWeight: '600', width: '80px', textAlign: 'right', opacity: '0.5' })
            usSpan.textContent = normalize ? `${r.pct.toFixed(1)}% (${formatValue(r.abs)})` : formatValue(r.pct)
            const txSpan = document.createElement('span')
            Object.assign(txSpan.style, { fontWeight: '700', width: '80px', textAlign: 'right', color: '#333f48' })
            txSpan.textContent = formatValue(r.overlayVal)
            const pctSpan = document.createElement('span')
            const sharePct = r.pct > 0 ? ((r.overlayVal / r.pct) * 100).toFixed(0) : '0'
            Object.assign(pctSpan.style, { fontSize: '12px', width: '44px', textAlign: 'right', color: overlayColor, fontWeight: '600' })
            pctSpan.textContent = `${sharePct}%`
            right.appendChild(usSpan)
            right.appendChild(txSpan)
            right.appendChild(pctSpan)
            row.appendChild(right)
          } else {
            const valSpan = document.createElement('span')
            Object.assign(valSpan.style, { fontWeight: '600', marginLeft: '16px' })
            valSpan.textContent = normalize ? `${r.pct.toFixed(1)}% (${formatValue(r.abs)})` : formatValue(r.pct)
            row.appendChild(valSpan)
          }
          body.appendChild(row)
        })
        tipDiv.appendChild(body)

        const footer = document.createElement('div')
        Object.assign(footer.style, { borderTop: '1px solid #e5e7eb', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: '700' })
        const totalLabel = document.createElement('span')
        totalLabel.textContent = 'Total'
        if (hasOverlay) {
          const right = document.createElement('span')
          Object.assign(right.style, { display: 'flex', gap: '16px' })
          const usTotal = document.createElement('span')
          Object.assign(usTotal.style, { width: '80px', textAlign: 'right', opacity: '0.5' })
          usTotal.textContent = normalize ? `100% (${formatValue(totalAbs)})` : formatValue(totalAbs)
          const txTotal = document.createElement('span')
          Object.assign(txTotal.style, { width: '80px', textAlign: 'right', color: '#333f48' })
          txTotal.textContent = formatValue(totalOverlay)
          const pctTotal = document.createElement('span')
          const totalShare = totalAbs > 0 ? ((totalOverlay / totalAbs) * 100).toFixed(0) : '0'
          Object.assign(pctTotal.style, { width: '44px', textAlign: 'right', color: overlayColor, fontWeight: '700', fontSize: '12px' })
          pctTotal.textContent = `${totalShare}%`
          right.appendChild(usTotal)
          right.appendChild(txTotal)
          right.appendChild(pctTotal)
          footer.appendChild(totalLabel)
          footer.appendChild(right)
        } else {
          const totalVal = document.createElement('span')
          totalVal.textContent = normalize ? `100% (${formatValue(totalAbs)})` : formatValue(totalAbs)
          footer.appendChild(totalLabel)
          footer.appendChild(totalVal)
        }
        tipDiv.appendChild(footer)

        // Position using viewport coordinates, clamped to stay on-screen
        const tipW = tipDiv.offsetWidth
        const tipH = tipDiv.offsetHeight
        const pad = 12

        let tx = event.clientX + 16
        if (tx + tipW + pad > window.innerWidth) tx = event.clientX - tipW - 16
        let ty = event.clientY - tipH - 10
        if (ty < pad) ty = event.clientY + 16
        // Final clamp
        tx = Math.max(pad, Math.min(tx, window.innerWidth - tipW - pad))
        ty = Math.max(pad, Math.min(ty, window.innerHeight - tipH - pad))

        tipDiv.style.left = `${tx}px`
        tipDiv.style.top = `${ty}px`
      })
      .on('mouseleave', function () {
        tipDiv.style.display = 'none'
        g.selectAll('.bar-layer').attr('opacity', mainOpacity)
        if (hasOverlay) g.selectAll('.overlay-layer').attr('opacity', 1)
      })

    // X Axis (centered tick marks, thinned labels when crowded)
    const nBars = chartData.length
    const barSlotW = innerW / nBars
    const domainVals = chartData.map((d) => d[xKey])
    const maxLabelLen = d3.max(domainVals, (v) => String(v).length) || 4
    // Use steeper rotation for longer labels (e.g. port names vs years)
    const rotAngle = maxLabelLen > 6 ? -50 : -35
    const minLabelSlot = maxLabelLen > 6 ? FS * 1.4 : FS * 2.2
    const every = barSlotW < minLabelSlot ? Math.ceil(minLabelSlot / barSlotW) : 1

    const xAxisG = g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickValues(domainVals.filter((_, i) => i % every === 0)).tickSize(0))
    xAxisG.select('.domain').remove()
    xAxisG.selectAll('.tick').append('line')
      .attr('y1', 0).attr('y2', TICK_HALF)
      .attr('stroke', '#9ca3af')
    xAxisG.selectAll('.tick text')
      .attr('font-size', `${FS}px`)
      .attr('fill', 'var(--color-text-secondary)')
      .attr('dy', '1.2em')
      .attr('transform', `rotate(${rotAngle})`)
      .attr('text-anchor', 'end')

    // Y Axis — dynamic unit (centered tick marks, skip zero)
    const yAxisG = g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat((v) => v === 0 ? '' : yLabelFmt(v)).tickSize(0))
    yAxisG.select('.domain').remove()
    yAxisG.selectAll('.tick').append('line')
      .attr('x1', -TICK_HALF).attr('x2', TICK_HALF)
      .attr('stroke', '#9ca3af')
    yAxisG.selectAll('.tick text')
      .attr('font-size', `${FS}px`)
      .attr('fill', 'var(--color-text-secondary)')
      .attr('dx', '-0.4em')
    yAxisG.selectAll('.tick').filter((d) => d === 0).remove()

    // Legend (centered, wraps to multiple rows if needed)
    const legendG = svg.append('g')

    // Shared legend-hover handlers: highlight one stack layer across all columns
    const bindLegendHover = (ig, item) => {
      ig.style('cursor', 'pointer')
        .on('mouseenter', function () {
          const ki = stackKeys.indexOf(item.key)
          svg.selectAll('.bar-layer').attr('opacity', function () {
            return d3.select(this).classed(`bar-layer-${ki}`) ? mainOpacity : 0.08
          })
          if (hasOverlay) {
            svg.selectAll('.overlay-layer').attr('opacity', function () {
              return d3.select(this).classed(`overlay-layer-${ki}`) ? 1 : 0.08
            })
          }
          legendG.selectAll('.legend-item').attr('opacity', 0.4)
          d3.select(this).attr('opacity', 1)
        })
        .on('mouseleave', function () {
          svg.selectAll('.bar-layer').attr('opacity', mainOpacity)
          if (hasOverlay) svg.selectAll('.overlay-layer').attr('opacity', 1)
          legendG.selectAll('.legend-item').attr('opacity', 1)
        })
    }

    // Measure total width for centering
    const legendItems = []
    let totalLegendW = 0
    stackKeys.forEach((key, i) => {
      const textW = key.length * LEGEND_CHAR_W
      const itemW = LEGEND_DOT_R * 2 + 10 + textW
      legendItems.push({ key, color: colorScale(key), itemW, textW })
      totalLegendW += itemW + (i < stackKeys.length - 1 ? LEGEND_GAP : 0)
    })

    const legendY = margin.top + innerH + margin.bottom + 14
    if (totalLegendW <= availLegendW) {
      // Single centered row
      const startX = margin.left + (availLegendW - totalLegendW) / 2
      let xOff = 0
      legendItems.forEach((item) => {
        const ig = legendG.append('g').attr('class', 'legend-item').attr('transform', `translate(${startX + xOff}, ${legendY})`)
        ig.append('circle').attr('cx', LEGEND_DOT_R).attr('cy', -1).attr('r', LEGEND_DOT_R).attr('fill', item.color)
        ig.append('text').attr('x', LEGEND_DOT_R * 2 + 10).attr('y', 5)
          .attr('font-size', `${FS}px`).attr('fill', 'var(--color-text-primary)').text(item.key)
        bindLegendHover(ig, item)
        xOff += item.itemW + LEGEND_GAP
      })
    } else {
      // Multi-row wrapping
      let xOff = 0
      let yOff = 0
      const rowH = 28
      legendItems.forEach((item) => {
        const fullW = item.itemW + LEGEND_GAP
        if (xOff + item.itemW > availLegendW && xOff > 0) { xOff = 0; yOff += rowH }
        const ig = legendG.append('g').attr('class', 'legend-item').attr('transform', `translate(${margin.left + xOff}, ${legendY + yOff})`)
        ig.append('circle').attr('cx', LEGEND_DOT_R).attr('cy', -1).attr('r', LEGEND_DOT_R).attr('fill', item.color)
        ig.append('text').attr('x', LEGEND_DOT_R * 2 + 10).attr('y', 5)
          .attr('font-size', `${FS}px`).attr('fill', 'var(--color-text-primary)').text(item.key)
        bindLegendHover(ig, item)
        xOff += fullW
      })
    }

    // Overlay legend annotation (below mode legend)
    if (hasOverlay) {
      const annotY = legendY + legendRows * 28 + 4
      const annotG = svg.append('g').attr('transform', `translate(${margin.left}, ${annotY})`)

      // "Solid = Texas" indicator
      annotG.append('rect')
        .attr('x', 0).attr('y', -6).attr('width', 14).attr('height', 12)
        .attr('rx', 2).attr('fill', CHART_COLORS[0])
      annotG.append('text').attr('x', 20).attr('y', 4)
        .attr('font-size', `${FS - 1}px`).attr('fill', 'var(--color-text-secondary)')
        .text(`= ${overlayLabel}`)

      // "Faded = Rest of U.S." indicator
      const fadedX = 20 + (overlayLabel.length + 2) * (FS * 0.55) + 20
      annotG.append('rect')
        .attr('x', fadedX).attr('y', -6).attr('width', 14).attr('height', 12)
        .attr('rx', 2).attr('fill', CHART_COLORS[0]).attr('opacity', 0.30)
      annotG.append('text').attr('x', fadedX + 20).attr('y', 4)
        .attr('font-size', `${FS - 1}px`).attr('fill', 'var(--color-text-secondary)')
        .text('= Rest of U.S.')
    }

    return () => { document.getElementById(tipId)?.remove() }
  }, [data, width, containerHeight, isFullscreen, xKey, stackKeys, animate, normalize, formatValue, overlayData, overlayLabel, overlayColor])

  // Ensure container expands for legend rows
  const estLegendRows = stackKeys.length > 0 ? Math.max(1, Math.ceil(stackKeys.length / 4)) : 0
  const minH = 320 + (estLegendRows > 0 ? 16 + estLegendRows * 28 : 0)

  return (
    <div ref={containerRef} className="w-full" style={{ minHeight: minH }}>
      <svg ref={svgRef} className="w-full" role="img" aria-label="Stacked bar chart visualization" />
    </div>
  )
}

export default React.memo(StackedBarChart)
