/**
 * ErrorBoundary.jsx — React class component error boundary
 * ---------------------------------------------------------
 * Catches JavaScript errors anywhere in its child component tree during
 * rendering, lifecycle methods, and constructors, and displays a friendly
 * fallback UI instead of crashing the entire application.
 *
 * Behavior
 *   - getDerivedStateFromError() sets the error state to trigger fallback rendering
 *   - componentDidCatch() logs the error and component stack to the console
 *   - The fallback UI shows a warning icon, an explanatory message, and a
 *     "Try again" button that resets the error state so the children attempt
 *     to re-render
 *
 * Usage
 *   Wrap any section of the component tree that should be isolated:
 *     <ErrorBoundary onRetry={() => store.loadData()}>
 *       <SomeChart />
 *     </ErrorBoundary>
 *   If <SomeChart> throws during render, the fallback UI replaces it while
 *   the rest of the page remains functional. The optional `onRetry` callback
 *   is invoked alongside the state reset when the user clicks "Try again",
 *   allowing data reloading or navigation recovery.
 *
 * Why a class component?
 *   React error boundaries require getDerivedStateFromError and componentDidCatch,
 *   which are only available in class components (as of React 19). There is no
 *   hooks-based equivalent.
 *
 * BOILERPLATE NOTE:
 *   This component is fully data-agnostic. No changes are needed when adapting
 *   this boilerplate for a new project or dataset.
 */
import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'

const MAX_RETRIES = 3

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, retryCount: 0 }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }))
    if (this.props.onRetry) this.props.onRetry()
  }

  render() {
    if (this.state.hasError) {
      const exhausted = this.state.retryCount >= MAX_RETRIES

      return (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center max-w-md px-6">
            <AlertTriangle size={40} className="text-brand-orange mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-text-primary mb-2">
              Something went wrong
            </h2>
            {exhausted ? (
              <>
                <p className="text-base text-text-secondary mb-4">
                  This section failed to load after several attempts. Please reload the page to try again.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 text-base font-medium text-white bg-brand-blue rounded-lg
                             hover:bg-brand-blue-dark transition-colors"
                >
                  Reload page
                </button>
              </>
            ) : (
              <>
                <p className="text-base text-text-secondary mb-4">
                  An error occurred while rendering this section. Try refreshing the page.
                </p>
                <button
                  onClick={this.handleRetry}
                  className="px-4 py-2 text-base font-medium text-white bg-brand-blue rounded-lg
                             hover:bg-brand-blue-dark transition-colors"
                >
                  Try again
                </button>
              </>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
