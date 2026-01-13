import { useState, useEffect, useRef, useMemo } from 'react'
import {
  getWikiMetadataForStructure,
  type WikiStructureMetadata,
  type WikiStructureLookupStatus,
} from '@/data/catalog/wikiMetadata'

/**
 * Result of the wiki metadata hook
 */
export interface UseWikiStructureMetadataResult {
  /** Current status of the lookup */
  readonly status: WikiStructureLookupStatus
  /** Metadata if found, null otherwise */
  readonly metadata: WikiStructureMetadata | null
}

/**
 * Internal state for the hook
 */
interface InternalState {
  status: WikiStructureLookupStatus
  metadata: WikiStructureMetadata | null
  forName: string | null
}

/**
 * Hook to fetch wiki metadata for a structure on-demand
 *
 * Features:
 * - Caches results (positive + negative) to avoid repeated requests
 * - Cancels in-flight requests when structure name changes
 * - Only fetches when `enabled` is true (for delayed hover scenarios)
 *
 * @param structureName - The structure name to look up (null to skip)
 * @param enabled - Whether to actually perform the lookup (default: true)
 * @returns Object with status and optional metadata
 */
export function useWikiStructureMetadata(
  structureName: string | null,
  enabled: boolean = true
): UseWikiStructureMetadataResult {
  const [state, setState] = useState<InternalState>({
    status: 'loading',
    metadata: null,
    forName: null,
  })

  // Track the current request to handle race conditions
  const abortControllerRef = useRef<AbortController | null>(null)

  // Compute the effective name (null if disabled)
  const effectiveName = enabled ? structureName : null

  useEffect(() => {
    // Cancel any in-flight request when effect re-runs
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Nothing to fetch
    if (!effectiveName) {
      return
    }

    // Start new request
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    getWikiMetadataForStructure(effectiveName, abortController.signal)
      .then((result) => {
        // Check if this request is still current
        if (abortController.signal.aborted) {
          return
        }

        setState({
          status: result.status,
          metadata: result.metadata,
          forName: effectiveName,
        })
      })
      .catch((error) => {
        // Check if this request is still current
        if (abortController.signal.aborted) {
          return
        }

        // Handle non-abort errors
        if (error instanceof Error && error.name !== 'AbortError') {
          console.warn('Wiki metadata hook error:', error)
          setState({
            status: 'error',
            metadata: null,
            forName: effectiveName,
          })
        }
      })

    // Cleanup: abort on unmount or when deps change
    return () => {
      abortController.abort()
    }
  }, [effectiveName])

  // Return appropriate state based on whether we have data for the current name
  const result = useMemo((): UseWikiStructureMetadataResult => {
    // If disabled or no name, return loading state
    if (!effectiveName) {
      return { status: 'loading', metadata: null }
    }

    // If we have data for a different name, we're loading the new one
    if (state.forName !== effectiveName) {
      return { status: 'loading', metadata: null }
    }

    // Return the cached state
    return { status: state.status, metadata: state.metadata }
  }, [effectiveName, state])

  return result
}
