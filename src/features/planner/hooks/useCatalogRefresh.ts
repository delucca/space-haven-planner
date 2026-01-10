import { useEffect, useRef } from 'react'
import type { Dispatch } from 'react'
import type { PlannerState, PlannerAction } from '../state/types'
import { loadCachedCatalog, saveCachedCatalog, isStale, fetchWikiCatalog } from '@/data/catalog'

/**
 * Hook to handle catalog loading from cache and refreshing from wiki
 *
 * On mount:
 * - Load cached catalog if valid
 * - If stale and online, attempt refresh
 *
 * On catalogRefreshRequestId change (manual refresh):
 * - Force refresh regardless of TTL
 */
export function useCatalogRefresh(state: PlannerState, dispatch: Dispatch<PlannerAction>) {
  const { catalogRefreshRequestId, catalogStatus } = state
  const isInitializedRef = useRef(false)
  const lastRefreshRequestIdRef = useRef(catalogRefreshRequestId)

  // Load from cache on mount
  useEffect(() => {
    if (isInitializedRef.current) return
    isInitializedRef.current = true

    const cached = loadCachedCatalog()
    if (cached) {
      dispatch({
        type: 'SET_CATALOG',
        catalog: cached.catalog,
        source: 'wiki_cache',
      })

      // If cache is stale and online, trigger a refresh
      if (isStale(cached.fetchedAt) && navigator.onLine) {
        dispatch({ type: 'REQUEST_CATALOG_REFRESH' })
      }
    } else if (navigator.onLine) {
      // No cache, try to fetch if online
      dispatch({ type: 'REQUEST_CATALOG_REFRESH' })
    }
  }, [dispatch])

  // Handle refresh requests (initial or manual)
  useEffect(() => {
    // Skip if this is the initial mount effect or if not refreshing
    if (!catalogStatus.isRefreshing) return

    // Skip if we already processed this request
    if (
      lastRefreshRequestIdRef.current === catalogRefreshRequestId &&
      catalogRefreshRequestId > 0
    ) {
      // Already processed
      return
    }
    lastRefreshRequestIdRef.current = catalogRefreshRequestId

    let cancelled = false

    async function doRefresh() {
      try {
        const result = await fetchWikiCatalog()

        if (cancelled) return

        // Save to cache
        saveCachedCatalog(result.catalog, result.revisionKey)

        // Update state
        dispatch({
          type: 'SET_CATALOG',
          catalog: result.catalog,
          source: 'wiki_fresh',
        })
      } catch (err) {
        if (cancelled) return

        const errorMessage = err instanceof Error ? err.message : 'Failed to refresh catalog'

        console.warn('Catalog refresh failed:', errorMessage)

        dispatch({
          type: 'SET_CATALOG_STATUS',
          status: {
            isRefreshing: false,
            lastError: errorMessage,
          },
        })
      }
    }

    doRefresh()

    return () => {
      cancelled = true
    }
  }, [catalogStatus.isRefreshing, catalogRefreshRequestId, dispatch])
}

