import { useEffect, lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useCrossingsStore } from '@/stores/crossingsStore'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import PageTransition from '@/components/ui/PageTransition'
import PageWrapper from '@/components/layout/PageWrapper'

const OverviewPage   = lazy(() => import('@/pages/Overview'))
const ByCrossingPage = lazy(() => import('@/pages/ByCrossing'))
const ByModePage     = lazy(() => import('@/pages/ByMode'))
const ByRegionPage   = lazy(() => import('@/pages/ByRegion'))
const AboutPage      = lazy(() => import('@/pages/About'))
const NotFoundPage   = lazy(() => import('@/pages/NotFound'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [pathname])
  return null
}

function DataLoadError({ error, onRetry, retrying }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-lg px-6">
        <AlertTriangle size={48} className="text-brand-orange mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-text-primary mb-2">
          Unable to load data
        </h2>
        <p className="text-base text-text-secondary mb-2">
          The dashboard could not load its data files. This may be a temporary
          network issue or the data files may be missing from the server.
        </p>
        <p className="text-base text-text-secondary/70 mb-6 font-mono break-all">
          {error}
        </p>
        <button
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-base font-medium text-white
                     bg-brand-blue rounded-lg hover:bg-brand-blue-dark transition-colors
                     disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <RefreshCw size={16} className={retrying ? 'animate-spin' : ''} />
          {retrying ? 'Retrying...' : 'Retry'}
        </button>
      </div>
    </div>
  )
}

function AppContent() {
  const init = useCrossingsStore((s) => s.init)
  const status = useCrossingsStore((s) => s.status)
  const error = useCrossingsStore((s) => s.error)

  useEffect(() => { init() }, [init])

  const retrying = status === 'loading'

  return (
    <PageWrapper>
      <ScrollToTop />
      {error ? (
        <DataLoadError error={error} onRetry={init} retrying={retrying} />
      ) : (
        <ErrorBoundary onRetry={init}>
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="w-10 h-10 border-3 border-brand-blue border-t-transparent rounded-full animate-spin" />
            </div>
          }>
            <PageTransition>
              <Routes>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/by-crossing" element={<ByCrossingPage />} />
                <Route path="/by-mode" element={<ByModePage />} />
                <Route path="/by-region" element={<ByRegionPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </PageTransition>
          </Suspense>
        </ErrorBoundary>
      )}
    </PageWrapper>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  )
}
