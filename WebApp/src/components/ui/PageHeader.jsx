/**
 * PageHeader.jsx — Page title + subtitle + breadcrumb navigation
 * ---------------------------------------------------------------
 * Renders a full-width header banner at the top of each page with:
 *   - An optional breadcrumb trail (array of { label, path? } objects)
 *   - A bold page title
 *   - An optional subtitle / description line
 *
 * The component uses the `container-chrome` layout (max-width 1280px, centered)
 * to match the site header/footer width, and sits on a light background with
 * a bottom border to visually separate it from the page content below.
 *
 * Breadcrumbs
 *   Each crumb with a `path` property renders as a clickable React Router NavLink.
 *   The last crumb typically omits `path` to display as plain text (current page).
 *   Crumbs are separated by chevron-right icons.
 *
 * Props
 *   @param {string}   title       — Main page heading
 *   @param {string}  [subtitle]   — Optional description below the title
 *   @param {Array<{ label: string, path?: string }>} [breadcrumbs] — Navigation trail
 *
 * BOILERPLATE NOTE:
 *   This component is data-agnostic. When adapting for a new project, update the
 *   breadcrumb labels, paths, and page titles in the PAGE components that use
 *   PageHeader — not here. This file does not need modification.
 */
import { NavLink } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export default function PageHeader({ title, subtitle, breadcrumbs }) {
  return (
    <div className="bg-surface-alt border-b border-border-light">
      <div className="container-chrome py-6">
        {/* Breadcrumb */}
        {breadcrumbs && (
          <nav className="flex items-center gap-1 text-base text-text-secondary mb-2">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} className="text-text-secondary/40" />}
                {crumb.path ? (
                  <NavLink to={crumb.path} className="hover:text-brand-blue transition-colors">
                    {crumb.label}
                  </NavLink>
                ) : (
                  <span className="text-text-primary font-medium">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h2 className="text-xl md:text-2xl font-bold text-text-primary">{title}</h2>
        {subtitle && (
          <p className="text-base text-text-secondary mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
