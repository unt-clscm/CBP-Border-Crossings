/**
 * TabBar.jsx — Horizontal tab navigation component
 * -------------------------------------------------
 * Renders a row of pill-style tab buttons with active/inactive states.
 * Used for sub-page navigation within a dashboard page.
 *
 * Props
 *   @param {Array<{key: string, label: string, icon?: Component}>} tabs
 *   @param {string}  activeTab  — Key of the currently active tab
 *   @param {(key: string) => void} onChange — Callback when a tab is clicked
 *   @param {string}  [className] — Additional CSS classes for the outer container
 *
 * BOILERPLATE NOTE:
 *   This component is fully data-agnostic. No changes are needed when adapting
 *   this boilerplate for a new project or dataset.
 */
import { useRef, useCallback } from 'react'

export default function TabBar({ tabs, activeTab, onChange, className = '', idPrefix = 'tab' }) {
  const tabRefs = useRef([])

  const handleKeyDown = useCallback((e, index) => {
    let newIndex = null
    if (e.key === 'ArrowRight') {
      newIndex = (index + 1) % tabs.length
    } else if (e.key === 'ArrowLeft') {
      newIndex = (index - 1 + tabs.length) % tabs.length
    } else if (e.key === 'Home') {
      newIndex = 0
    } else if (e.key === 'End') {
      newIndex = tabs.length - 1
    }
    if (newIndex !== null) {
      e.preventDefault()
      onChange(tabs[newIndex].key)
      tabRefs.current[newIndex]?.focus()
    }
  }, [tabs, onChange])

  return (
    <div
      className={`border-y border-border bg-surface-alt py-3 ${className}`}
    >
      <div
        className="flex justify-center gap-2 overflow-x-auto scrollbar-hide px-4"
        role="tablist"
      >
        {tabs.map((tab, i) => {
          const isActive = tab.key === activeTab
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              id={`${idPrefix}-${tab.key}`}
              ref={(el) => { tabRefs.current[i] = el }}
              role="tab"
              aria-selected={isActive}
              aria-controls={`${idPrefix}-panel-${tab.key}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.key)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className={`flex items-center gap-2 px-5 py-2.5 text-base font-semibold
                          rounded-full whitespace-nowrap transition-all duration-200 cursor-pointer
                          ${isActive
                            ? 'bg-brand-blue text-white shadow-md'
                            : 'bg-white text-text-secondary border border-border hover:border-brand-blue hover:text-brand-blue hover:shadow-sm'
                          }`}
            >
              {Icon && <Icon size={18} />}
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
