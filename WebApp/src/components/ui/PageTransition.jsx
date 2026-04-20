/**
 * PageTransition — fade + slide transition on route change
 * Wraps page content and triggers a brief enter animation when the
 * location pathname changes.
 */
import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

export default function PageTransition({ children }) {
  const { pathname } = useLocation()
  const [phase, setPhase] = useState('enter') // 'exit' | 'enter'
  const [displayChildren, setDisplayChildren] = useState(children)
  const timeoutRef = useRef(null)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // On route change, start exit then swap content and enter
    setPhase('exit')
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setDisplayChildren(children)
      setPhase('enter')
    }, 150) // exit duration
    return () => clearTimeout(timeoutRef.current)
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Also update children when they change without route change (data loading, etc.)
  useEffect(() => {
    if (phase === 'enter') {
      setDisplayChildren(children)
    }
  }, [children]) // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div
      className={`transition-all duration-300 ease-out ${
        phase === 'enter'
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-2'
      }`}
    >
      {displayChildren}
    </div>
  )
}
