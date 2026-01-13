import { useEffect, useRef } from 'react'
import type { Dispatch } from 'react'
import type { PlannerState, PlannerAction, CatalogStatus } from '../state/types'
import { loadCachedJarCatalog, getBuiltinCatalog } from '@/data/jarCatalog'
import { capture } from '@/lib/analytics'

/**
 * Hook to handle catalog loading from cache on mount
 *
 * Catalog source priority:
 * 1. User-uploaded JAR (cached) - highest priority
 * 2. Built-in JAR snapshot - primary source (already loaded by default)
 */
export function useCatalogRefresh(_state: PlannerState, dispatch: Dispatch<PlannerAction>) {
  const isInitializedRef = useRef(false)

  // Load catalog on mount following source priority
  useEffect(() => {
    if (isInitializedRef.current) return
    isInitializedRef.current = true

    // Priority 1: User-uploaded JAR (cached)
    const jarCache = loadCachedJarCatalog()
    if (jarCache) {
      dispatch({
        type: 'SET_CATALOG',
        catalog: jarCache.catalog,
        source: 'jar_user_cache',
      })
      dispatch({
        type: 'SET_CATALOG_STATUS',
        status: {
          jarFileName: jarCache.sourceInfo.fileName,
        } as Partial<CatalogStatus>,
      })
      capture('catalog_loaded', { source: 'jar_user_cache' })
      return
    }

    // Priority 2: Built-in JAR snapshot (already loaded by default in createInitialState)
    dispatch({
      type: 'SET_CATALOG',
      catalog: getBuiltinCatalog(),
      source: 'jar_builtin_snapshot',
    })
    capture('catalog_loaded', { source: 'jar_builtin_snapshot' })
  }, [dispatch])
}
