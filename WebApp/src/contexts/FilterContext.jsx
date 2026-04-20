import { createContext, useContext } from 'react'

const FilterContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useFilterContext() {
  const ctx = useContext(FilterContext)
  if (ctx === null) {
    throw new Error('useFilterContext must be used within a FilterContext.Provider (e.g. DashboardLayout)')
  }
  return ctx
}

export default FilterContext
