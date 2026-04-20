import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md px-6">
        <h2 className="text-4xl font-bold text-brand-blue mb-2">404</h2>
        <p className="text-xl font-semibold text-text-primary mb-2">
          Page not found
        </p>
        <p className="text-base text-text-secondary mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 text-base font-medium text-white
                     bg-brand-blue rounded-lg hover:bg-brand-blue-dark transition-colors"
        >
          <Home size={16} />
          Back to Overview
        </Link>
        <nav className="mt-6" aria-label="Main pages">
          <p className="text-base text-text-secondary mb-2">Or jump to:</p>
          <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <li><Link to="/" className="text-base text-brand-blue hover:underline">Overview</Link></li>
            <li><Link to="/by-crossing" className="text-base text-brand-blue hover:underline">By Crossing</Link></li>
            <li><Link to="/by-mode" className="text-base text-brand-blue hover:underline">By Mode</Link></li>
            <li><Link to="/by-region" className="text-base text-brand-blue hover:underline">By Region</Link></li>
            <li><Link to="/about" className="text-base text-brand-blue hover:underline">About</Link></li>
          </ul>
        </nav>
      </div>
    </div>
  )
}
