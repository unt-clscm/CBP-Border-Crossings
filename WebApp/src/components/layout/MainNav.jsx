/**
 * Responsive navigation bar. Desktop: horizontal links. Mobile: hamburger menu.
 */
import { useState, useRef, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'

const navItems = [
  { label: 'Overview',   path: '/' },
  { label: 'By Crossing', path: '/by-crossing' },
  { label: 'By Mode',     path: '/by-mode' },
  { label: 'By Region',   path: '/by-region' },
  { label: 'About',       path: '/about' },
]

export default function MainNav() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const hamburgerRef = useRef(null)
  const firstLinkRef = useRef(null)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  const prevOpen = useRef(false)
  useEffect(() => {
    if (mobileOpen && !prevOpen.current) {
      requestAnimationFrame(() => firstLinkRef.current?.focus())
    } else if (!mobileOpen && prevOpen.current) {
      hamburgerRef.current?.focus()
    }
    prevOpen.current = mobileOpen
  }, [mobileOpen])

  return (
    <nav className="bg-brand-blue relative z-40">
      <div className="container-chrome">
        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-0.5 h-12">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `group/nav px-4 h-full flex items-center text-base font-medium transition-all duration-200 relative
                 ${isActive
                   ? 'bg-brand-blue-dark text-white shadow-inner'
                   : 'text-white/90 hover:bg-brand-blue-dark/60 hover:text-white'
                 }`
              }
            >
              {item.label}
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] bg-white/80 rounded-full transition-all duration-300 w-0 group-hover/nav:w-3/4" />
            </NavLink>
          ))}
        </div>

        {/* Mobile Toggle */}
        <div className="md:hidden flex items-center justify-between h-12 px-1">
          <span className="text-white text-base font-medium">Navigation</span>
          <button
            ref={hamburgerRef}
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-white p-1.5 hover:bg-brand-blue-dark/60 rounded transition-colors"
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile Menu */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out
            ${mobileOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
        >
          <div className="pb-3 space-y-0.5">
            {navItems.map((item, i) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                ref={i === 0 ? firstLinkRef : undefined}
                className={({ isActive }) =>
                  `block px-4 py-2.5 text-base font-medium transition-colors duration-150
                   ${isActive
                     ? 'bg-brand-blue-dark text-white'
                     : 'text-white/85 hover:bg-brand-blue-dark/50 hover:text-white'
                   }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
