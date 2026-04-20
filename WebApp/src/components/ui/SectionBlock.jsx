/**
 * SectionBlock.jsx — Full-width section wrapper with alternating background
 * --------------------------------------------------------------------------
 * A simple layout primitive that wraps page content in a full-width <section>
 * element with consistent horizontal padding (via `container-main`) and
 * vertical spacing (via `section-padding`).
 *
 * The `alt` prop toggles between a white background (default) and the
 * `bg-surface-alt` light gray, making it easy to create alternating visual
 * bands on a page for content separation.
 *
 * Props
 *   @param {boolean} [alt=false]   — If true, uses the alternate gray background
 *   @param {string}  [className=''] — Additional CSS classes for the outer <section>
 *   @param {ReactNode} children    — Page content to wrap
 *
 * BOILERPLATE NOTE:
 *   This component is fully data-agnostic. No changes are needed when adapting
 *   this boilerplate for a new project or dataset.
 */
import { useRef, useState, useEffect } from 'react'

export default function SectionBlock({ alt = false, className = '', children }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Observe with generous rootMargin so off-screen sections trigger early
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.05, rootMargin: '0px 0px 150px 0px' }
    )
    observer.observe(el)

    // Fallback: always show after 1.2s so content is never permanently hidden
    // (covers headless browsers, fast scroll, anchor links, tab switches)
    const timer = setTimeout(() => setVisible(true), 1200)

    return () => {
      observer.disconnect()
      clearTimeout(timer)
    }
  }, [])

  return (
    <section
      ref={ref}
      className={`${alt ? 'bg-surface-alt' : 'bg-white'} transition-all duration-700 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      } ${className}`}
    >
      <div className="container-main section-padding">
        {children}
      </div>
    </section>
  )
}
