import { useLocation } from 'react-router-dom'
import SiteHeader from './SiteHeader'
import MainNav from './MainNav'
import Footer from './Footer'

export default function PageWrapper({ children }) {
  const { pathname } = useLocation()
  const hideFooter = pathname === '/' || pathname === '/about'

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-brand-blue focus:text-white focus:rounded-lg focus:text-base focus:font-medium"
      >
        Skip to main content
      </a>
      <SiteHeader />
      <MainNav />
      <main id="main-content" className="flex-1">{children}</main>
      {!hideFooter && <Footer />}
    </div>
  )
}
