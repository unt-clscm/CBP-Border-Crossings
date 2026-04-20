import { useState, useRef, useEffect } from 'react'

const GLOSSARY = {
  maquiladora: 'A factory in Mexico, usually near the U.S. border, that imports materials duty-free for assembly and re-exports the finished goods. Central to the cross-border manufacturing economy.',
  'Bajio': 'The Baj\u00edo region of central Mexico (Guanajuato, Quer\u00e9taro, Aguascalientes, San Luis Potos\u00ed). A fast-growing automotive and aerospace manufacturing hub.',
  FTZ: 'Foreign Trade Zone \u2014 a designated area where goods can be imported, stored, and processed with deferred or reduced customs duties.',
  'HS 2-digit': 'Harmonized Schedule 2-digit code \u2014 an international system that classifies traded goods into ~99 categories (e.g., 87 = Vehicles, 27 = Mineral Fuels).',
  DF: 'Domestic/Foreign indicator \u2014 DF=1 means the goods originated in the U.S.; DF=2 means re-export of foreign goods. Only applies to exports.',
}

export default function GlossaryTerm({ term, display }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const definition = GLOSSARY[term]

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!definition) return <span>{display || term}</span>

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="underline decoration-dotted decoration-brand-blue/40 underline-offset-2 text-inherit font-inherit cursor-help hover:decoration-brand-blue transition-colors"
        aria-label={`Definition of ${display || term}`}
      >
        {display || term}
      </button>
      {open && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-white border border-border-light rounded-lg shadow-lg p-3 text-sm text-text-secondary leading-relaxed">
          <span className="font-semibold text-text-primary block mb-1">{display || term}</span>
          {definition}
          <span className="absolute top-full left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border-r border-b border-border-light rotate-45 -mt-1.5" />
        </span>
      )}
    </span>
  )
}
