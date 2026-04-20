/**
 * FilterMultiSelect.jsx — Multi-select dropdown with checkboxes (data-agnostic)
 * ------------------------------------------------------------------------------
 * Supports:
 *   - "All" state represented by an empty array []
 *   - String options and { value, label } object options
 *   - Grouped options with non-clickable subheaders
 *   - Search/filter input for long lists
 *   - Scrollable dropdown with configurable max height
 *   - Outside click dismissal
 *   - ARIA listbox/option pattern with arrow-key navigation
 *   - Portal-based dropdown to escape overflow:auto clipping in sidebars
 *   - Auto drop-up/drop-down based on available space within the sidebar
 */
import { useState, useRef, useEffect, useLayoutEffect, useMemo, useId, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, Search } from 'lucide-react'

function getVal(opt) {
  return typeof opt === 'string' ? opt : opt.value
}
function getLbl(opt) {
  return typeof opt === 'string' ? opt : opt.label
}

export default function FilterMultiSelect({
  label,
  value = [],
  options = [],
  groups = null,
  onChange,
  allLabel = 'All',
  searchable = false,
  maxHeight = 280,
}) {
  const id = useId()
  const listboxId = `${id}-listbox`
  const labelId = `${id}-label`
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [focusIdx, setFocusIdx] = useState(-1)
  const ref = useRef(null)
  const searchRef = useRef(null)
  const triggerRef = useRef(null)
  const dropdownRef = useRef(null)
  const optionRefs = useRef([])
  const [computedMaxH, setComputedMaxH] = useState(maxHeight)
  const [dropUp, setDropUp] = useState(false)
  // Portal position (fixed coordinates)
  const [portalPos, setPortalPos] = useState({ top: 0, left: 0, width: 0 })

  // Close on outside click — check both the trigger area and the portal dropdown
  useEffect(() => {
    const handleClick = (e) => {
      const inTrigger = ref.current && ref.current.contains(e.target)
      const inDropdown = dropdownRef.current && dropdownRef.current.contains(e.target)
      if (!inTrigger && !inDropdown) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Compute available space and portal position — same logic as the airport
  // dashboard but using fixed positioning via a portal so the dropdown escapes
  // the sidebar's overflow-y-auto clipping.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return

    const reposition = () => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      // Find nearest scrollable ancestor (the sidebar's overflow-y-auto div)
      let container = triggerRef.current.parentElement
      while (container) {
        const { overflow, overflowY } = getComputedStyle(container)
        if (/(auto|scroll)/.test(overflow + overflowY)) break
        container = container.parentElement
      }
      // Measure space within the scroll container's visible bounds, clamped to viewport
      const raw = container
        ? container.getBoundingClientRect()
        : { top: 0, bottom: window.innerHeight }
      const bounds = {
        top: Math.max(0, raw.top),
        bottom: Math.min(window.innerHeight, raw.bottom),
      }
      const spaceBelow = bounds.bottom - rect.bottom - 8
      const spaceAbove = rect.top - bounds.top - 8
      const shouldDropUp = spaceAbove > spaceBelow
      setDropUp(shouldDropUp)
      const available = shouldDropUp ? spaceAbove : spaceBelow
      setComputedMaxH(Math.max(200, available))
      // Position the portal dropdown in fixed viewport coordinates
      setPortalPos({
        top: shouldDropUp ? rect.top - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      })
    }

    reposition()

    // Keep position updated on scroll (capture phase for nested containers) and resize
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  // Flatten all options (from groups, nested subgroups, or flat list)
  const allOptions = useMemo(() => {
    if (groups) {
      return groups.flatMap((g) =>
        g.subgroups ? g.subgroups.flatMap((sg) => sg.options) : g.options
      )
    }
    return options
  }, [groups, options])

  const optionValues = useMemo(() => allOptions.map(getVal), [allOptions])

  const allSelected = value.length === 0

  const matchesSearch = useCallback(
    (lbl) => !search || lbl.toLowerCase().includes(search.toLowerCase()),
    [search],
  )

  const toggle = useCallback((val) => {
    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val))
    } else {
      const next = [...value, val]
      onChange(next.length === optionValues.length ? [] : next)
    }
  }, [value, onChange, optionValues])

  const selectAll = useCallback(() => onChange([]), [onChange])

  // Reset search, dropUp, and focusIdx when dropdown closes; focus search when it opens
  useEffect(() => {
    if (!open) {
      setSearch('')
      setDropUp(false)
      setFocusIdx(-1)
    } else if (searchable) {
      requestAnimationFrame(() => searchRef.current?.focus())
    }
  }, [open, searchable])

  // Build flat list of visible option values for keyboard navigation
  // Index 0 = "All" option, rest are data options
  const visibleOptions = useMemo(() => {
    const opts = allOptions.filter((opt) => matchesSearch(getLbl(opt)))
    return ['__all__', ...opts.map(getVal)]
  }, [allOptions, matchesSearch])

  // Scroll focused option into view
  useEffect(() => {
    if (focusIdx >= 0 && optionRefs.current[focusIdx]) {
      optionRefs.current[focusIdx].scrollIntoView({ block: 'nearest' })
    }
  }, [focusIdx])

  // Keyboard handler for the dropdown
  const handleKeyDown = useCallback((e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
        setFocusIdx(0)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusIdx((prev) => Math.min(prev + 1, visibleOptions.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusIdx((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (focusIdx >= 0 && focusIdx < visibleOptions.length) {
          const val = visibleOptions[focusIdx]
          if (val === '__all__') selectAll()
          else toggle(val)
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
        break
      case 'Home':
        e.preventDefault()
        setFocusIdx(0)
        break
      case 'End':
        e.preventDefault()
        setFocusIdx(visibleOptions.length - 1)
        break
      default:
        break
    }
  }, [open, focusIdx, visibleOptions, selectAll, toggle])

  const displayLabel = allSelected
    ? allLabel
    : value.length === 1
      ? getLbl(allOptions.find((o) => getVal(o) === value[0]) || value[0])
      : `${value.length} selected`

  const renderOption = (opt) => {
    const val = getVal(opt)
    const lbl = getLbl(opt)
    if (!matchesSearch(lbl)) return null
    const checked = value.includes(val)
    const idx = visibleOptions.indexOf(val)
    const isFocused = idx === focusIdx
    return (
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- keyboard handled by parent listbox per WAI-ARIA managed-focus pattern
      <div
        key={val}
        id={idx >= 0 ? `${listboxId}-opt-${idx}` : undefined}
        ref={(el) => { if (idx >= 0) optionRefs.current[idx] = el }}
        role="option"
        aria-selected={checked}
        tabIndex={-1}
        onClick={() => toggle(val)}
        onMouseEnter={() => setFocusIdx(idx)}
        className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left cursor-pointer transition-colors ${checked ? 'bg-brand-blue/10 font-medium text-brand-blue' : ''} ${isFocused ? 'bg-brand-blue/10 outline outline-2 outline-brand-blue/30' : 'hover:bg-brand-blue/5'}`}
      >
        <span
          className={`flex-shrink-0 flex items-center justify-center w-4 h-4 rounded border ${checked ? 'bg-brand-blue border-brand-blue' : 'border-border'}`}
        >
          {checked && <Check size={12} className="text-white" />}
        </span>
        <span className="truncate">{lbl}</span>
      </div>
    )
  }

  const renderGroups = () => {
    return groups.map((group) => {
      // Nested subgroups (e.g. Class → U.S./Foreign carriers)
      if (group.subgroups) {
        const visibleSubs = group.subgroups
          .map((sg) => ({ ...sg, visible: sg.options.filter((opt) => matchesSearch(getLbl(opt))) }))
          .filter((sg) => sg.visible.length > 0)
        if (visibleSubs.length === 0) return null
        return (
          <div key={group.label} role="group" aria-label={group.label}>
            <div className="px-3 py-1.5 text-[11px] font-bold text-text-primary uppercase tracking-wider bg-gray-100 border-t border-border/40 sticky top-0 z-10">
              {group.label}
            </div>
            {visibleSubs.map((sg) => (
              <div key={sg.label} role="group" aria-label={sg.label}>
                <div className="px-3 pl-5 py-1 text-[10px] font-semibold text-text-secondary uppercase tracking-wider bg-gray-50 border-t border-border/20 sticky top-7 z-[9]">
                  {sg.label}
                </div>
                {sg.visible.map(renderOption)}
              </div>
            ))}
          </div>
        )
      }
      // Simple group (e.g. airports by state)
      const visibleOpts = group.options.filter((opt) => matchesSearch(getLbl(opt)))
      if (visibleOpts.length === 0) return null
      return (
        <div key={group.label} role="group" aria-label={group.label}>
          <div className="px-3 py-1.5 text-[11px] font-semibold text-text-secondary uppercase tracking-wider bg-white border-t border-border/40 sticky top-0 z-10">
            {group.label}
          </div>
          {visibleOpts.map(renderOption)}
        </div>
      )
    })
  }

  const renderFlatOptions = () => {
    return allOptions.filter((opt) => matchesSearch(getLbl(opt))).map(renderOption)
  }

  // Dropdown panel — rendered via portal to escape sidebar overflow-y-auto clipping
  const dropdownPanel = open && createPortal(
    <div
      ref={dropdownRef}
      id={listboxId}
      role="listbox"
      aria-multiselectable="true"
      aria-labelledby={labelId}
      aria-activedescendant={focusIdx >= 0 ? `${listboxId}-opt-${focusIdx}` : undefined}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="fixed z-[9999] bg-white border border-border rounded-lg shadow-lg flex flex-col overflow-hidden"
      style={{
        left: `${portalPos.left}px`,
        width: `${portalPos.width}px`,
        maxHeight: `${computedMaxH}px`,
        ...(dropUp
          ? { bottom: `${window.innerHeight - portalPos.top}px` }
          : { top: `${portalPos.top}px` }),
      }}
    >
      {/* All option */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- keyboard handled by parent listbox per WAI-ARIA managed-focus pattern */}
      <div
        id={`${listboxId}-opt-0`}
        ref={(el) => { optionRefs.current[0] = el }}
        role="option"
        aria-selected={allSelected}
        tabIndex={-1}
        onClick={selectAll}
        onMouseEnter={() => setFocusIdx(0)}
        className={`flex-shrink-0 w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left cursor-pointer transition-colors ${allSelected ? 'bg-brand-blue/10 font-medium text-brand-blue' : ''} ${focusIdx === 0 ? 'bg-brand-blue/10 outline outline-2 outline-brand-blue/30' : 'hover:bg-brand-blue/5'}`}
      >
        <span
          className={`flex-shrink-0 flex items-center justify-center w-4 h-4 rounded border ${allSelected ? 'bg-brand-blue border-brand-blue' : 'border-border'}`}
        >
          {allSelected && <Check size={12} className="text-white" />}
        </span>
        {allLabel}
      </div>

      {/* Search input */}
      {searchable && (
        <div className="flex-shrink-0 px-2 py-1.5 border-t border-border/40">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary"
            />
            <input
              ref={searchRef}
              type="text"
              aria-label="Search options"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-7 pr-2 py-1 text-sm rounded border border-border/60 bg-surface-secondary/30
                         focus:outline-none focus:ring-1 focus:ring-brand-blue/30 focus:border-brand-blue/40"
            />
          </div>
        </div>
      )}

      {/* Options list (scrollable) */}
      <div className="overflow-y-auto flex-1 min-h-0">
        {groups ? renderGroups() : renderFlatOptions()}
      </div>
    </div>,
    document.body,
  )

  return (
    <div className="flex flex-col gap-1 min-w-0 w-full" ref={ref}>
      <label id={labelId} className="text-base font-medium text-text-secondary uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          onKeyDown={handleKeyDown}
          aria-labelledby={labelId}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? listboxId : undefined}
          className="appearance-none w-full px-3 py-2 pr-8 rounded-lg border border-border
                     bg-white text-base text-text-primary text-left
                     focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue
                     transition-all duration-150 cursor-pointer"
        >
          <span className={allSelected ? 'text-text-secondary' : ''}>
            {displayLabel}
          </span>
        </button>
        <ChevronDown
          size={14}
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </div>
      {dropdownPanel}
    </div>
  )
}
