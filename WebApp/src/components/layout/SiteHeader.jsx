/**
 * Top-level header displayed on every page.
 * Logo (left) + Dashboard title (center).
 */
export default function SiteHeader() {
  return (
    <header className="bg-white border-b border-border-light">
      <div className="container-chrome flex items-center justify-between py-4 gap-6">
        <div className="flex items-center gap-4 min-w-0">
          <img
            src={`${import.meta.env.BASE_URL}assets/Logos/TxDOT-Logo-Vertical-RGB.svg`}
            alt="TxDOT"
            className="h-12 md:h-14 w-auto flex-shrink-0"
            onError={(e) => { e.target.style.display = 'none' }}
          />
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold text-brand-blue leading-tight truncate">
              CBP Border Crossings Dashboard
            </h1>
            <p className="text-sm text-text-secondary leading-snug truncate">
              Northbound traffic at Texas–Mexico ports of entry
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
