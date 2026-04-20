/**
 * TreemapChart — D3 treemap with rounded cells, compact labels, and a
 * viewport-fixed tooltip that escapes overflow-hidden parents.
 *
 * PROPS
 * @param {Array<Object>} data        [{ [nameKey]: 'Crossing A', [valueKey]: 12345 }, ...]
 * @param {string}  [nameKey='label']
 * @param {string}  [valueKey='value']
 * @param {Function}[formatValue]
 * @param {boolean} [animate=true]
 * @param {Function}[onCellClick]     Called with the leaf's name on click
 */
import React, { useRef, useEffect } from 'react'
import * as d3 from 'd3'
import { useChartResize, getResponsiveFontSize } from '@/lib/useChartResize'
import { CHART_COLORS, formatCompact } from '@/lib/chartColors'

function TreemapChart({
  data = [],
  nameKey = 'label',
  valueKey = 'value',
  formatValue = formatCompact,
  animate = true,
  onCellClick,
}) {
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const { width, height: containerHeight, isFullscreen } = useChartResize(containerRef)

  useEffect(() => {
    if (!data.length || !width) return

    const FS = getResponsiveFontSize(width, isFullscreen)
    const height = isFullscreen
      ? Math.max(640, containerHeight > 100 ? containerHeight : 640)
      : 640
    const safeWidth = Math.max(1, width)
    const safeHeight = Math.max(1, height)

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', safeWidth).attr('height', safeHeight)

    const colorScale = d3.scaleOrdinal().range(CHART_COLORS)

    const root = d3.hierarchy({
      children: data.map((d) => ({ name: d[nameKey], value: d[valueKey] })),
    })
      .sum((d) => d.value)
      .sort((a, b) => b.value - a.value)

    d3.treemap()
      .size([safeWidth, safeHeight])
      .padding(3)
      .round(true)(root)

    const cell = svg.selectAll('.cell')
      .data(root.leaves())
      .enter()
      .append('g')
      .attr('class', 'cell')
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`)

    cell.append('rect')
      .attr('width', (d) => Math.max(0, d.x1 - d.x0))
      .attr('height', (d) => Math.max(0, d.y1 - d.y0))
      .attr('rx', 4)
      .attr('fill', (d) => colorScale(d.data.name))
      .attr('opacity', animate ? 0 : 0.85)
      .transition()
      .duration(animate ? 500 : 0)
      .delay((d, i) => (animate ? i * 30 : 0))
      .attr('opacity', 0.85)

    cell.each(function (d) {
      const w = d.x1 - d.x0
      const h = d.y1 - d.y0
      if (w < 45 || h < 26) return

      const g = d3.select(this)
      const fo = g.append('foreignObject')
        .attr('width', w)
        .attr('height', h)
        .style('pointer-events', 'none')

      const div = fo.append('xhtml:div')
        .style('padding', '4px 6px')
        .style('overflow', 'hidden')
        .style('width', `${w}px`)
        .style('height', `${h}px`)
        .style('box-sizing', 'border-box')

      div.append('xhtml:div')
        .style('font-size', `${FS}px`)
        .style('font-weight', '600')
        .style('color', 'white')
        .style('line-height', '1.3')
        .style('white-space', 'nowrap')
        .style('overflow', 'hidden')
        .style('text-overflow', 'ellipsis')
        .text(d.data.name)

      if (h > 36) {
        div.append('xhtml:div')
          .style('font-size', `${FS}px`)
          .style('color', 'rgba(255,255,255,0.8)')
          .style('line-height', '1.3')
          .style('white-space', 'nowrap')
          .style('overflow', 'hidden')
          .style('text-overflow', 'ellipsis')
          .text(`(${formatValue(d.data.value)} Crossings)`)
      }
    })

    let tipDiv = document.getElementById('cbp-treemap-tooltip')
    if (!tipDiv) {
      tipDiv = document.createElement('div')
      tipDiv.id = 'cbp-treemap-tooltip'
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

    cell
      .on('mouseenter', function (event, d) {
        d3.select(this).select('rect').attr('opacity', 1)
        tipDiv.textContent = ''
        const nameDiv = document.createElement('div')
        Object.assign(nameDiv.style, { fontWeight: '700', fontSize: '16px', marginBottom: '6px' })
        nameDiv.textContent = d.data.name
        tipDiv.appendChild(nameDiv)
        const valDiv = document.createElement('div')
        Object.assign(valDiv.style, { borderTop: '1px solid #e5e7eb', paddingTop: '6px', fontWeight: '600', fontSize: '16px' })
        valDiv.textContent = formatValue(d.data.value)
        tipDiv.appendChild(valDiv)
        tipDiv.style.display = 'block'
      })
      .on('mousemove', function (event) {
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
      .on('mouseleave', function () {
        d3.select(this).select('rect').attr('opacity', 0.85)
        tipDiv.style.display = 'none'
      })
      .on('click', function (event, d) {
        if (onCellClick) onCellClick(d.data.name)
      })
      .style('cursor', onCellClick ? 'pointer' : 'default')

    return () => { document.getElementById('cbp-treemap-tooltip')?.remove() }
  }, [data, width, containerHeight, isFullscreen, nameKey, valueKey, animate, onCellClick, formatValue])

  return (
    <div ref={containerRef} className="w-full relative" style={{ minHeight: 640 }}>
      <svg ref={svgRef} className="w-full" role="img" aria-label="Treemap chart visualization" />
    </div>
  )
}

export default React.memo(TreemapChart)
