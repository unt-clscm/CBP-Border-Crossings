import { Globe } from 'lucide-react'

export default function UtilityBar() {
  return (
    <div className="bg-brand-gray-light/60 backdrop-blur-sm border-b border-border-light">
      <div className="container-chrome flex items-center justify-end gap-2 sm:gap-4 py-1.5 text-base text-text-secondary">
        <a
          href="https://www.txdot.gov/contact-us.html"
          className="hover:text-brand-blue transition-colors duration-150 text-right"
        >
          Contact us &raquo;
        </a>
        <span className="hidden sm:block w-px h-3 bg-border" />
        <button className="hidden sm:flex items-center gap-1 hover:text-brand-blue transition-colors duration-150">
          <Globe size={12} />
          English
        </button>
      </div>
    </div>
  )
}
