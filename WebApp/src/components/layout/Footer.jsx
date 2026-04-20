import { useCrossingsStore } from '@/stores/crossingsStore'

export default function Footer() {
  const minYear = useCrossingsStore((s) => s.minYear)
  const maxYear = useCrossingsStore((s) => s.maxYear)
  const range = minYear && maxYear ? `${minYear}–${maxYear}` : '2008–2025'
  return (
    <footer className="bg-brand-gray-light/60 border-t border-border">
      <div className="container-chrome py-4 flex items-center justify-center">
        <p className="text-base text-text-primary text-center">
          Data source: U.S. Customs and Border Protection (CBP), northbound crossings at Texas–Mexico border crossings, {range}.
        </p>
      </div>
    </footer>
  )
}
