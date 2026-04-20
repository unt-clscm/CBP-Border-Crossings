/**
 * ── exportPng.js ────────────────────────────────────────────────────────────
 * Export an SVG chart as a high-resolution PNG image with optional title and
 * subtitle rendered above the chart.
 *
 * ── HOW IT WORKS ────────────────────────────────────────────────────────────
 * 1. Clones the live SVG DOM node
 * 2. Inlines computed CSS styles (browsers strip external styles on export)
 * 3. Converts <foreignObject> → native SVG <text> (browser security blocks
 *    HTML inside SVG when loaded as an Image)
 * 4. Serializes to SVG blob → draws onto a 2× canvas → triggers PNG download
 *
 * ── BOILERPLATE: WHAT TO CHANGE FOR A NEW PROJECT ───────────────────────────
 * - Font family: Change "IBM Plex Sans" on lines drawing title/subtitle if
 *   your project uses a different typeface.
 * - Title color: Change '#333f48' to your brand's text-primary color.
 * - Scale factor: Change `scale = 2` for different DPI (3 for ultra-high-res).
 * - The function is data-agnostic — it exports whatever SVG it finds in the
 *   container, so no changes are needed when swapping datasets.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *
 * @param {HTMLElement} container – DOM node that contains the SVG
 * @param {string}      filename – file name without extension
 * @param {string}     [title]   – chart title to render above the image
 * @param {string}     [subtitle]– chart subtitle to render below the title
 */
export function exportChartPng(container, filename = 'chart', title, subtitle) {
  const svg = container?.querySelector('svg')
  if (!svg) return

  const clone = svg.cloneNode(true)
  const { width, height } = svg.getBoundingClientRect()

  // Guard against zero-dimension SVGs (e.g. chart not yet rendered)
  if (!width || !height) {
    console.warn('PNG export: SVG has zero dimensions — chart may not be rendered yet')
    return
  }

  // Set explicit dimensions so the image renders at the correct size
  clone.setAttribute('width', width)
  clone.setAttribute('height', height)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  // Remove elements marked as export-ignore (e.g. zoom reset button)
  clone.querySelectorAll('.export-ignore').forEach((el) => el.remove())

  // Inline computed styles on every element
  inlineStyles(svg, clone)

  // Replace foreignObject elements with SVG <text> equivalents.
  // Browsers refuse to render foreignObject HTML content when an SVG
  // is loaded as an image (security restriction), which silently breaks export.
  replaceForeignObjects(clone)

  const serializer = new XMLSerializer()
  const svgString = serializer.serializeToString(clone)
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  const scale = 2 // 2× for retina-quality export (BOILERPLATE: change to 3 for 3× DPI)
  const padding = 20
  const titleFontSize = 18
  const subtitleFontSize = 16
  const titleLineHeight = titleFontSize * 1.3
  const subtitleLineHeight = subtitleFontSize * 1.4
  const gapAfterHeader = 12

  // Calculate header height
  let headerHeight = 0
  if (title) headerHeight += titleLineHeight
  if (subtitle) headerHeight += subtitleLineHeight
  if (title || subtitle) headerHeight += gapAfterHeader

  const totalWidth = width + padding * 2
  const totalHeight = height + padding * 2 + headerHeight

  const canvas = document.createElement('canvas')
  canvas.width = totalWidth * scale
  canvas.height = totalHeight * scale

  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)

  // White background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, totalWidth, totalHeight)

  // Draw title (BOILERPLATE: change font-family if not using IBM Plex Sans)
  let textY = padding
  if (title) {
    ctx.fillStyle = '#333f48'
    ctx.font = `600 ${titleFontSize}px "IBM Plex Sans", system-ui, sans-serif`
    ctx.textBaseline = 'top'
    ctx.fillText(title, padding, textY)
    textY += titleLineHeight
  }

  // Draw subtitle
  if (subtitle) {
    ctx.fillStyle = '#6b7280'
    ctx.font = `400 ${subtitleFontSize}px "IBM Plex Sans", system-ui, sans-serif`
    ctx.textBaseline = 'top'
    ctx.fillText(subtitle, padding, textY)
    textY += subtitleLineHeight
  }

  const img = new Image()

  img.onload = () => {
    const chartY = padding + headerHeight
    ctx.drawImage(img, padding, chartY, width, height)
    URL.revokeObjectURL(url)

    const a = document.createElement('a')
    a.download = `${filename}.png`
    a.href = canvas.toDataURL('image/png')
    a.click()
  }

  img.onerror = () => {
    URL.revokeObjectURL(url)
    console.warn('PNG export: failed to load SVG as image')
  }

  img.src = url
}

/**
 * Recursively copy computed styles from source elements to cloned elements.
 * Only copies SVG-relevant properties to keep the clone lightweight.
 */
function inlineStyles(source, target) {
  const computed = window.getComputedStyle(source)
  const props = [
    'font', 'font-family', 'font-size', 'font-weight', 'font-style',
    'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap',
    'opacity', 'visibility', 'display', 'text-anchor', 'dominant-baseline',
    'letter-spacing', 'color',
  ]
  for (const prop of props) {
    const val = computed.getPropertyValue(prop)
    if (val) target.style.setProperty(prop, val)
  }

  const sourceChildren = source.children
  const targetChildren = target.children
  for (let i = 0; i < sourceChildren.length; i++) {
    if (targetChildren[i]) inlineStyles(sourceChildren[i], targetChildren[i])
  }
}

/**
 * Replace <foreignObject> elements in an SVG clone with native SVG <text>.
 * Browsers block HTML content inside foreignObject when loading SVG as an
 * image, so we extract the text and re-create it as SVG text nodes.
 */
function replaceForeignObjects(svgClone) {
  const foreignObjects = svgClone.querySelectorAll('foreignObject')
  if (!foreignObjects.length) return

  foreignObjects.forEach((fo) => {
    const parent = fo.parentNode
    const w = parseFloat(fo.getAttribute('width') || 0)

    // Collect text from leaf div elements (skip container divs that have children)
    const leaves = []
    fo.querySelectorAll('div').forEach((div) => {
      if (div.querySelector('div')) return // skip containers
      const text = div.textContent?.trim()
      if (text) {
        leaves.push({
          text,
          fontSize: div.style.fontSize || '16px',
          fontWeight: div.style.fontWeight || 'normal',
          color: div.style.color || 'white',
        })
      }
    })

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    const pad = 6
    let yPos = pad

    leaves.forEach((leaf) => {
      const fs = parseFloat(leaf.fontSize) || 16
      yPos += fs // move down to baseline

      const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      textEl.setAttribute('x', String(pad))
      textEl.setAttribute('y', String(yPos))
      textEl.setAttribute('fill', leaf.color)
      textEl.setAttribute('font-size', `${fs}px`)
      textEl.setAttribute('font-weight', leaf.fontWeight)
      textEl.setAttribute('font-family', '"IBM Plex Sans", system-ui, sans-serif')
      // Truncate long labels to fit the cell width
      const maxChars = Math.max(1, Math.floor((w - pad * 2) / (fs * 0.6)))
      textEl.textContent =
        leaf.text.length > maxChars
          ? leaf.text.slice(0, maxChars - 1) + '…'
          : leaf.text

      g.appendChild(textEl)
      yPos += fs * 0.3 // gap between lines
    })

    parent.replaceChild(g, fo)
  })
}
