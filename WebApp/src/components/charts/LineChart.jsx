/**
 * LineChart — Multi-series line chart with zoom, tooltips, and optional area fill.
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
 * Renders one or more line series on a shared x/y plane. Supports:
 *   - Multi-series via `seriesKey` (each unique value becomes its own line)
 *   - D3 brush-style zoom on the x-axis (scroll to zoom, drag to pan)
 *   - An HTML tooltip built with safe DOM APIs (no innerHTML) that follows
 *     the cursor and shows all series values at the hovered x position
 *   - Optional gradient area fill for single-series charts
 *   - Animated line-drawing entrance effect (stroke-dashoffset trick)
 *   - A "Reset zoom" button that appears when zoomed in
 *
 * ZOOM & ZoomRangeContext
 * When the user zooms, the component reports the visible x-domain range to
 * its parent ChartCard via `ZoomRangeContext`. ChartCard uses this to filter
 * the CSV export so only the visible data is downloaded. If the context is
 * not provided (chart not inside a ChartCard), zoom still works visually
 * but the range isn't reported anywhere.
 *
 * CLIP PATH
 * All line paths, dots, and area fills are rendered inside a `<g>` with a
 * `clip-path` so that when the user zooms/pans, geometry outside the plot
 * area is clipped rather than overflowing into the axes or margins.
 *
 * PROPS
 * @param {Array<Object>} data
 *   Flat array of data points. Each object must have at least `xKey` and
 *   `yKey`. If multi-series, each object also needs `seriesKey`.
 *   Example: [{ year: 2020, value: 500000, Mode: 'Truck' }, ...]
 *
 * @param {string} [xKey='year']
 *   Property name for the x-axis (must be numeric — used with scaleLinear).
 *
 * @param {string} [yKey='value']
 *   Property name for the y-axis (numeric).
 *
 * @param {string} [seriesKey]
 *   Optional. Property name whose unique values split data into separate
 *   line series. If omitted, a single line is drawn.
 *
 * @param {Function} [formatValue=formatCompact]
 *   Formatter for tooltip values and y-axis labels.
 *
 * @param {boolean} [showArea=false]
 *   If true AND there is only one series, a subtle gradient area fill is
 *   rendered below the line.
 *
 * @param {boolean} [animate=true]
 *   Whether lines animate in via stroke-dashoffset on first render.
 *
 * @param {Array<Object>} [annotations=[]]
 *   Optional overlay annotations rendered on the chart. Each object can have:
 *     - x: numeric x-value for a vertical line or band start
 *     - x2: optional numeric x-value for band end (omit for a single line)
 *     - label: optional text label
 *     - color: band/line color (default: 'rgba(217,13,13,0.08)')
 *     - labelColor: label text color (default: '#d90d0d')
 *
 * EDGE CASES & LIMITATIONS
 * - A single data point renders a dot but no visible line (two points
 *   minimum to see a connecting stroke).
 * - xKey must be numeric (years, indices, etc.). Categorical x-axes are
 *   not supported — use BarChart or StackedBarChart instead.
 * - Tooltip x-snapping uses Math.round, which assumes integer x values.
 *   For fractional x-axes, the snapping logic would need adjustment.
 * - The legend only appears when there are 2+ series.
 */
import React, { useRef, useEffect, useContext } from 'react'
import * as d3 from 'd3'
import { useChartResize, getResponsiveFontSize } from '@/lib/useChartResize'
import { CHART_COLORS, formatCompact } from '@/lib/chartColors'
import { ZoomRangeContext } from '@/components/ui/ChartCard'

function LineChart({
  data = [],
  xKey = 'year',
  yKey = 'value',
  seriesKey,
  formatValue = formatCompact,
  formatX,
  showArea = false,
  animate = true,
  annotations = [],
  colorOverrides,  // { seriesName: '#color' } — override ordinal colors for specific series
}) {
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const { width, height: containerHeight, isFullscreen } = useChartResize(containerRef)
  const setZoomRange = useContext(ZoomRangeContext)

  useEffect(() => {
    if (!data.length || !width) return

    const FS = getResponsiveFontSize(width, isFullscreen)

    // Dynamic left margin: measure the longest Y-axis label to prevent clipping
    const yMinEst = d3.min(data, (d) => d[yKey]) || 0
    const yMaxEst = d3.max(data, (d) => d[yKey]) || 1
    const yTicksEst = d3.scaleLinear().domain([Math.min(0, yMinEst), yMaxEst]).nice().ticks(5)
    const maxYLabelLen = d3.max(yTicksEst, (v) => (v === 0 ? '' : formatValue(v)).length) || 4
    const dynamicLeft = Math.max(48, maxYLabelLen * (FS * 0.6) + 16)

    const margin = isFullscreen
      ? { top: 20, right: 28, bottom: 72, left: Math.max(100, dynamicLeft) }
      : { top: 16, right: 32, bottom: 60, left: dynamicLeft }

    // ── Pre-calculate legend dimensions ──────────────────────────
    const LEGEND_FONT = FS
    const LEGEND_DOT_R = 6
    const LEGEND_GAP = 28          // gap between legend items
    const LEGEND_DOT_TEXT_GAP = 10  // gap between dot and text
    let legendRows = 0

    const seriesGroups = seriesKey ? d3.group(data, (d) => d[seriesKey]) : null
    const seriesNames = seriesGroups ? Array.from(seriesGroups.keys()) : []

    if (seriesKey && seriesNames.length > 1) {
      const availW = width - margin.left - margin.right
      let rowOffset = 0
      legendRows = 1
      seriesNames.forEach((name) => {
        const itemW = LEGEND_DOT_R * 2 + LEGEND_DOT_TEXT_GAP + name.length * (LEGEND_FONT * 0.55) + LEGEND_GAP
        if (rowOffset + itemW > availW && rowOffset > 0) { legendRows++; rowOffset = 0 }
        rowOffset += itemW
      })
    }
    const legendSpace = legendRows > 0 ? 16 + legendRows * 28 : 0
    const defaultH = 300 + legendSpace
    // In normal mode, use the computed default height to prevent feedback loops
    // where h-full containers in CSS grids cause unbounded SVG growth.
    // In fullscreen mode, fill the available container height.
    const height = isFullscreen
      ? Math.max(defaultH, containerHeight > 100 ? containerHeight : defaultH)
      : defaultH
    const innerW = Math.max(1, width - margin.left - margin.right)
    const innerH = Math.max(1, height - margin.top - margin.bottom - legendSpace)

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', height)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // ── Clip path for zoom ─────────────────────────────────────────
    const clipId = `line-clip-${Math.random().toString(36).slice(2, 9)}`
    svg.append('defs').append('clipPath').attr('id', clipId)
      .append('rect').attr('width', innerW).attr('height', innerH)

    const contentG = g.append('g').attr('clip-path', `url(#${clipId})`)

    // ── Process series ───────────────────────────────────────────
    let series
    if (seriesKey) {
      const grouped = d3.group(data, (d) => d[seriesKey])
      series = Array.from(grouped, ([name, values]) => ({
        name,
        values: [...values].sort((a, b) => a[xKey] - b[xKey]),
      }))
    } else {
      series = [{ name: 'default', values: [...data].sort((a, b) => a[xKey] - b[xKey]) }]
    }

    // ── Scales ───────────────────────────────────────────────────
    const allValues = data.map((d) => d[yKey])
    const x = d3.scaleLinear()
      .domain(d3.extent(data, (d) => d[xKey]))
      .range([0, innerW])

    // x0 is the unzoomed copy of the x scale. D3's zoom.rescaleX needs an
    // immutable reference to recompute the zoomed domain on every zoom event.
    const x0 = x.copy()

    const yMin = d3.min(allValues) || 0
    const yMax = d3.max(allValues) || 1
    const y = d3.scaleLinear()
      .domain([Math.min(0, yMin), yMax])
      .nice()
      .range([innerH, 0])

    const baseColorScale = d3.scaleOrdinal().range(CHART_COLORS)
    const colorScale = colorOverrides
      ? (name) => colorOverrides[name] || baseColorScale(name)
      : baseColorScale

    // Mutable reference to the current (possibly zoomed) x scale. Updated by
    // the zoom handler; read by the tooltip mousemove handler.
    let currentX = x

    // Unique x values from the data (for tick deduplication when zoomed)
    const uniqueXValues = [...new Set(data.map((d) => d[xKey]))].sort((a, b) => a - b)

    // ── Horizontal grid lines (skip zero) — static ──────────────
    const yTicks = y.ticks(5).filter((t) => t !== 0)
    g.append('g')
      .selectAll('line')
      .data(yTicks)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d))
      .attr('stroke', '#9ca3af')
      .attr('stroke-dasharray', '4,4')
      .attr('stroke-width', 1)

    // ── Vertical grid lines — in clipped group ────────────────────
    const vgridG = contentG.append('g')
    const drawVGrid = (sx) => {
      vgridG.selectAll('line').remove()
      const ticks = sx.ticks(Math.min(data.length, 12))
      vgridG.selectAll('line').data(ticks).enter()
        .append('line')
        .attr('x1', (d) => sx(d))
        .attr('x2', (d) => sx(d))
        .attr('y1', 0)
        .attr('y2', innerH)
        .attr('stroke', '#9ca3af')
        .attr('stroke-dasharray', '4,4')
        .attr('stroke-width', 1)
    }
    drawVGrid(x)

    // ── X-Axis line (solid baseline) ─────────────────────────────
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', innerH)
      .attr('y2', innerH)
      .attr('stroke', '#9ca3af')
      .attr('stroke-width', 1)

    // ── Zero line (when data has negative values) ──────────────
    if (yMin < 0) {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', y(0))
        .attr('y2', y(0))
        .attr('stroke', '#9ca3af')
        .attr('stroke-width', 1.5)
    }

    // ── Y-Axis line (solid left edge) ────────────────────────────
    g.append('line')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', '#9ca3af')
      .attr('stroke-width', 1)

    // ── Line generator ───────────────────────────────────────────
    const line = d3.line()
      .x((d) => x(d[xKey]))
      .y((d) => y(d[yKey]))
      .curve(d3.curveMonotoneX)

    // ── Area fill (subtle gradient) — in clipped group ───────────
    if (showArea && series.length === 1) {
      const gradientId = `area-gradient-${clipId}`
      const areaDefs = svg.select('defs').size() ? svg.select('defs') : svg.append('defs')
      const grad = areaDefs.append('linearGradient')
        .attr('id', gradientId)
        .attr('x1', '0%').attr('y1', '0%')
        .attr('x2', '0%').attr('y2', '100%')
      grad.append('stop').attr('offset', '0%').attr('stop-color', CHART_COLORS[0]).attr('stop-opacity', 0.15)
      grad.append('stop').attr('offset', '100%').attr('stop-color', CHART_COLORS[0]).attr('stop-opacity', 0.02)

      const area = d3.area()
        .x((d) => x(d[xKey]))
        .y0(innerH)
        .y1((d) => y(d[yKey]))
        .curve(d3.curveMonotoneX)

      contentG.append('path')
        .datum(series[0].values)
        .attr('class', 'area-path')
        .attr('fill', `url(#${gradientId})`)
        .attr('d', area)
    }

    // ── Annotation bands / lines ─────────────────────────────────
    annotations.forEach((ann) => {
      if (ann.x == null) return
      const x1Pos = x(ann.x)
      const x2Pos = ann.x2 != null ? x(ann.x2) : x1Pos

      if (ann.x2 != null) {
        contentG.append('rect')
          .attr('class', 'ann-band')
          .datum(ann)
          .attr('x', Math.min(x1Pos, x2Pos))
          .attr('width', Math.abs(x2Pos - x1Pos))
          .attr('y', 0)
          .attr('height', innerH)
          .attr('fill', ann.color || 'rgba(217,13,13,0.08)')
          .attr('pointer-events', 'none')
      } else {
        contentG.append('line')
          .attr('class', 'ann-line')
          .datum(ann)
          .attr('x1', x1Pos).attr('x2', x1Pos)
          .attr('y1', 0).attr('y2', innerH)
          .attr('stroke', ann.color || '#d90d0d')
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '6,4')
          .attr('pointer-events', 'none')
      }

      if (ann.label) {
        contentG.append('text')
          .attr('class', 'ann-label')
          .datum(ann)
          .attr('x', ann.x2 != null ? (x1Pos + x2Pos) / 2 : x1Pos + 4)
          .attr('y', 14)
          .attr('text-anchor', ann.x2 != null ? 'middle' : 'start')
          .attr('font-size', `${FS * 0.8}px`)
          .attr('fill', ann.labelColor || '#d90d0d')
          .attr('pointer-events', 'none')
          .text(ann.label)
      }
    })

    // ── Lines + dots — in clipped group ─────────────────────────
    series.forEach((s, i) => {
      const path = contentG.append('path')
        .datum(s.values)
        .attr('class', 'line-path')
        .attr('fill', 'none')
        .attr('stroke', colorScale(s.name))
        .attr('stroke-width', 3.5)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('d', line)

      if (animate) {
        const totalLength = path.node().getTotalLength()
        path
          .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
          .attr('stroke-dashoffset', totalLength)
          .transition()
          .duration(1000)
          .delay(i * 200)
          .ease(d3.easeCubicOut)
          .attr('stroke-dashoffset', 0)
      }

      // Data-point dots
      contentG.selectAll(`.dot-${i}`).data(s.values).enter()
        .append('circle')
        .attr('class', 'data-dot')
        .attr('cx', (d) => x(d[xKey]))
        .attr('cy', (d) => y(d[yKey]))
        .attr('r', 4)
        .attr('fill', 'white')
        .attr('stroke', colorScale(s.name))
        .attr('stroke-width', 2)
        .attr('opacity', 0)
        .transition()
        .delay(animate ? 800 + i * 200 : 0)
        .duration(300)
        .attr('opacity', 1)
    })

    // ── HTML Tooltip (fixed to viewport, escapes overflow-hidden) ──
    const tipId = `line-chart-tooltip-${clipId}`
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
        fontFamily: 'inherit', color: '#333f48', maxWidth: '360px',
      })
      document.body.appendChild(tipDiv)
    }

    // SVG guide line + highlight dots (kept in SVG for visual context)
    const guideLine = g.append('line')
      .attr('y1', 0).attr('y2', innerH)
      .attr('stroke', '#9ca3af')
      .attr('stroke-dasharray', '4,3')
      .attr('stroke-width', 1)
      .style('display', 'none')
    const highlightDots = g.append('g').style('display', 'none')

    const overlay = g.append('rect')
      .attr('width', innerW).attr('height', innerH)
      .attr('fill', 'transparent')
      .on('mousemove', function(event) {
        const [mx] = d3.pointer(event)
        const xVal = Math.round(currentX.invert(mx))
        const xPos = currentX(xVal)

        guideLine.attr('x1', xPos).attr('x2', xPos).style('display', null)
        highlightDots.selectAll('*').remove()
        highlightDots.style('display', null)

        const points = []
        series.forEach((s) => {
          const point = s.values.find((d) => d[xKey] === xVal)
          if (point) points.push({ point, name: s.name, color: colorScale(s.name) })
        })
        if (!points.length) { tipDiv.style.display = 'none'; return }

        // Highlight dots on chart
        points.forEach((p) => {
          highlightDots.append('circle')
            .attr('cx', xPos)
            .attr('cy', y(p.point[yKey]))
            .attr('r', 6)
            .attr('fill', p.color)
            .attr('stroke', 'white')
            .attr('stroke-width', 2.5)
        })

        // Build tooltip using safe DOM APIs — textContent and createElement
        // only. Never use innerHTML to prevent XSS from data values.
        tipDiv.textContent = ''
        const header = document.createElement('div')
        Object.assign(header.style, { fontWeight: '700', fontSize: '16px', marginBottom: '6px' })
        header.textContent = formatX ? formatX(xVal) : xVal
        tipDiv.appendChild(header)

        const body = document.createElement('div')
        Object.assign(body.style, { borderTop: '1px solid #e5e7eb', paddingTop: '6px' })
        points.forEach((p) => {
          const label = p.name !== 'default' ? p.name : ''
          const row = document.createElement('div')
          Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' })
          const left = document.createElement('span')
          Object.assign(left.style, { display: 'flex', alignItems: 'center', gap: '6px' })
          const dot = document.createElement('span')
          Object.assign(dot.style, { width: '10px', height: '10px', borderRadius: '50%', background: p.color, flexShrink: '0' })
          const labelSpan = document.createElement('span')
          labelSpan.style.color = '#6b7280'
          labelSpan.textContent = label
          left.appendChild(dot)
          left.appendChild(labelSpan)
          const valSpan = document.createElement('span')
          Object.assign(valSpan.style, { fontWeight: '600', marginLeft: '16px' })
          valSpan.textContent = formatValue(p.point[yKey])
          row.appendChild(left)
          row.appendChild(valSpan)
          body.appendChild(row)
        })
        tipDiv.appendChild(body)
        tipDiv.style.display = 'block'

        // Position using viewport coordinates, clamped to stay on-screen
        const tipW = tipDiv.offsetWidth
        const tipH = tipDiv.offsetHeight
        const pad = 12
        let tx = event.clientX + 16
        if (tx + tipW + pad > window.innerWidth) tx = event.clientX - tipW - 16
        let ty = event.clientY - tipH - 10
        if (ty < pad) ty = event.clientY + 16
        tx = Math.max(pad, Math.min(tx, window.innerWidth - tipW - pad))
        ty = Math.max(pad, Math.min(ty, window.innerHeight - tipH - pad))
        tipDiv.style.left = `${tx}px`
        tipDiv.style.top = `${ty}px`
      })
      .on('mouseleave', () => {
        tipDiv.style.display = 'none'
        guideLine.style('display', 'none')
        highlightDots.style('display', 'none')
      })

    // ── X-Axis helper ────────────────────────────────────────────
    const TICK_HALF = 5
    const xAxisG = g.append('g')
      .attr('transform', `translate(0,${innerH})`)

    // Subsample ticks when there are too many unique x values
    const maxTicks = Math.max(4, Math.floor(innerW / 80))
    const tickVals = uniqueXValues.length > maxTicks
      ? uniqueXValues.filter((_, i) => i % Math.ceil(uniqueXValues.length / maxTicks) === 0)
      : uniqueXValues
    const xTickFormat = formatX || d3.format('d')

    const styleXAxis = (sx) => {
      xAxisG.call(
        d3.axisBottom(sx)
          .tickValues(tickVals)
          .tickFormat(xTickFormat)
          .tickSize(0)
      )
      xAxisG.select('.domain').remove()
      xAxisG.selectAll('.custom-tick').remove()
      xAxisG.selectAll('.tick text')
        .attr('font-size', `${FS}px`)
        .attr('fill', 'var(--color-text-secondary)')
        .attr('dy', '1.2em')
      xAxisG.selectAll('.tick').append('line')
        .attr('class', 'custom-tick')
        .attr('y1', -TICK_HALF)
        .attr('y2', TICK_HALF)
        .attr('stroke', '#9ca3af')
        .attr('stroke-width', 1)
      xAxisG.selectAll('.tick').each(function (d) {
        const pos = sx(d)
        d3.select(this).style('display', pos >= -20 && pos <= innerW + 20 ? null : 'none')
      })
    }
    styleXAxis(x)

    // ── Y-Axis (tick marks span both sides, skip zero) ──────────
    const yAxisG = g.append('g')
      .call(
        d3.axisLeft(y)
          .ticks(5)
          .tickFormat((v) => v === 0 ? '' : formatValue(v))
          .tickSize(0)
      )
    yAxisG.select('.domain').remove()
    yAxisG.selectAll('.tick text')
      .attr('font-size', '16px')
      .attr('fill', 'var(--color-text-secondary)')
      .attr('dx', '-0.4em')
    // Draw centered tick marks on y-axis
    yAxisG.selectAll('.tick').append('line')
      .attr('x1', -TICK_HALF)
      .attr('x2', TICK_HALF)
      .attr('stroke', '#9ca3af')
      .attr('stroke-width', 1)
    // Remove the zero tick element entirely
    yAxisG.selectAll('.tick')
      .filter((d) => d === 0)
      .remove()

    // ── Zoom behavior ────────────────────────────────────────────
    const uniqueX = new Set(data.map((d) => d[xKey])).size
    const maxZoom = uniqueX > 3 ? Math.ceil(uniqueX / 3) : 1

    if (maxZoom > 1) {
      const resetBtn = g.append('g')
        .attr('class', 'export-ignore')
        .attr('transform', `translate(${innerW - 100}, 2)`)
        .attr('cursor', 'pointer')
        .style('display', 'none')
      resetBtn.append('rect')
        .attr('rx', 4).attr('width', 100).attr('height', 28)
        .attr('fill', '#f3f4f6').attr('stroke', '#d1d5db')
      resetBtn.append('text')
        .attr('x', 50).attr('y', 19)
        .attr('text-anchor', 'middle')
        .attr('font-size', `${FS}px`).attr('fill', '#6b7280')
        .text('Reset zoom')

      const zoom = d3.zoom()
        .scaleExtent([1, maxZoom])
        .translateExtent([[0, 0], [innerW, innerH]])
        .extent([[0, 0], [innerW, innerH]])
        .on('zoom', (event) => {
          const t = event.transform
          currentX = t.rescaleX(x0)

          // Hide tooltip during zoom
          tipDiv.style.display = 'none'
          guideLine.style('display', 'none')
          highlightDots.style('display', 'none')

          // Rebuild line generator with zoomed scale
          const zoomedLine = d3.line()
            .x((d) => currentX(d[xKey]))
            .y((d) => y(d[yKey]))
            .curve(d3.curveMonotoneX)

          // Update line paths
          contentG.selectAll('.line-path')
            .attr('d', (d) => zoomedLine(d))
            .attr('stroke-dasharray', null)
            .attr('stroke-dashoffset', null)

          // Update dots
          contentG.selectAll('.data-dot')
            .attr('cx', (d) => currentX(d[xKey]))
            .attr('opacity', 1)

          // Update area
          if (showArea && series.length === 1) {
            const zoomedArea = d3.area()
              .x((d) => currentX(d[xKey]))
              .y0(innerH)
              .y1((d) => y(d[yKey]))
              .curve(d3.curveMonotoneX)
            contentG.selectAll('.area-path')
              .attr('d', (d) => zoomedArea(d))
          }

          // Update annotations
          contentG.selectAll('.ann-band').each(function (ann) {
            const p1 = currentX(ann.x), p2 = currentX(ann.x2)
            d3.select(this).attr('x', Math.min(p1, p2)).attr('width', Math.abs(p2 - p1))
          })
          contentG.selectAll('.ann-line').each(function (ann) {
            const px = currentX(ann.x)
            d3.select(this).attr('x1', px).attr('x2', px)
          })
          contentG.selectAll('.ann-label').each(function (ann) {
            const px = ann.x2 != null
              ? (currentX(ann.x) + currentX(ann.x2)) / 2
              : currentX(ann.x) + 4
            d3.select(this).attr('x', px)
          })

          // Update vertical grid
          drawVGrid(currentX)

          // Update x-axis
          styleXAxis(currentX)

          resetBtn.style('display', t.k > 1 ? null : 'none')

          // Report the visible x-domain to ChartCard via ZoomRangeContext so
          // the "Download CSV" action only exports the zoomed-in data range.
          if (setZoomRange) {
            if (t.k > 1) {
              const domain = currentX.domain()
              setZoomRange({ xKey, min: Math.ceil(domain[0]), max: Math.floor(domain[1]) })
            } else {
              setZoomRange(null)
            }
          }
        })

      resetBtn.on('click', () => {
        overlay.transition().duration(300).call(zoom.transform, d3.zoomIdentity)
      })
      overlay.call(zoom)
    }

    // ── Legend (line + hollow marker, centered below x-axis) ────────
    if (seriesKey && series.length > 1) {
      const legendG = svg.append('g')
      const LINE_W = 30       // width of the line segment in legend
      const MARKER_R = 4      // hollow circle radius (matches chart dots)
      const TEXT_GAP = 8      // gap between line segment and text

      // Measure items
      const items = []
      let totalW = 0
      series.forEach((s, i) => {
        const textW = s.name.length * (LEGEND_FONT * 0.55)
        const itemW = LINE_W + TEXT_GAP + textW
        items.push({ name: s.name, color: colorScale(s.name), itemW })
        totalW += itemW + (i < series.length - 1 ? LEGEND_GAP : 0)
      })

      const availW = innerW
      const legendY = margin.top + innerH + margin.bottom - 2

      const drawLegendItem = (ig, item) => {
        // Line segment
        ig.append('line')
          .attr('x1', 0).attr('x2', LINE_W)
          .attr('y1', 0).attr('y2', 0)
          .attr('stroke', item.color)
          .attr('stroke-width', 3.5)
          .attr('stroke-linecap', 'round')
        // Hollow circle marker in the middle
        ig.append('circle')
          .attr('cx', LINE_W / 2).attr('cy', 0)
          .attr('r', MARKER_R)
          .attr('fill', 'white')
          .attr('stroke', item.color)
          .attr('stroke-width', 2)
        // Label text
        ig.append('text')
          .attr('x', LINE_W + TEXT_GAP)
          .attr('y', 5)
          .attr('font-size', `${LEGEND_FONT}px`)
          .attr('fill', 'var(--color-text-primary)')
          .text(item.name)
      }

      if (totalW <= availW) {
        const startX = margin.left + (innerW - totalW) / 2
        let xOff = 0
        items.forEach((item) => {
          const ig = legendG.append('g').attr('transform', `translate(${startX + xOff}, ${legendY})`)
          drawLegendItem(ig, item)
          xOff += item.itemW + LEGEND_GAP
        })
      } else {
        let xOff = 0
        let yOff = 0
        const rowH = 28
        items.forEach((item) => {
          if (xOff + item.itemW > availW && xOff > 0) { xOff = 0; yOff += rowH }
          const ig = legendG.append('g')
            .attr('transform', `translate(${margin.left + xOff}, ${legendY + yOff})`)
          drawLegendItem(ig, item)
          xOff += item.itemW + LEGEND_GAP
        })
      }
    }

    return () => { document.getElementById(tipId)?.remove() }
  }, [data, width, containerHeight, isFullscreen, xKey, yKey, seriesKey, formatX, showArea, animate, annotations, formatValue, setZoomRange, colorOverrides])

  // Ensure container expands for legend rows
  const seriesCount = seriesKey ? new Set(data.map(d => d[seriesKey])).size : 0
  const estLegendRows = seriesCount > 1 ? Math.max(1, Math.ceil(seriesCount / 4)) : 0
  const minH = 300 + (estLegendRows > 0 ? 16 + estLegendRows * 28 : 0)

  return (
    <div ref={containerRef} className="w-full h-full" style={{ minHeight: minH }}>
      <svg ref={svgRef} className="w-full" role="img" aria-label="Line chart visualization" />
    </div>
  )
}

export default React.memo(LineChart)
