/**
 * Hook for handling Space Haven JAR file import
 *
 * Provides functionality to:
 * - Parse user-uploaded spacehaven.jar files
 * - Convert to catalog format
 * - Update application state
 * - Cache for future sessions
 */

import { useCallback, useRef } from 'react'
import type { Dispatch } from 'react'
import type { PlannerAction, CatalogStatus } from '@/features/planner/state/types'
import {
  parseJarFile,
  convertToStructureCatalog,
  saveJarCatalogCache,
  type JarSourceInfo,
} from '@/data/jarCatalog'
import { capture } from '@/lib/analytics'

/**
 * Return type for the useJarImport hook
 */
export interface JarImportResult {
  /** Trigger file selection dialog */
  selectJarFile: () => void
  /** Handle a file that was dropped or selected */
  handleJarFile: (file: File) => Promise<void>
  /** Reference to the hidden file input element */
  fileInputRef: React.RefObject<HTMLInputElement | null>
  /** Handle file input change event */
  onFileInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}

/**
 * Hook for importing Space Haven JAR files
 */
export function useJarImport(dispatch: Dispatch<PlannerAction>): JarImportResult {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  /**
   * Process a JAR file and update the catalog
   */
  const handleJarFile = useCallback(
    async (file: File) => {
      // Validate file name
      if (!file.name.endsWith('.jar')) {
        dispatch({
          type: 'SET_CATALOG_STATUS',
          status: {
            lastError: 'Please select a .jar file (spacehaven.jar)',
            isParsing: false,
          } as Partial<CatalogStatus>,
        })
        return
      }

      // Signal parsing started
      dispatch({ type: 'REQUEST_JAR_PARSE' })

      try {
        // Parse the JAR file
        const parsedData = await parseJarFile(file)

        // Convert to catalog format
        const catalog = convertToStructureCatalog(parsedData)

        // Create source info for caching
        const sourceInfo: JarSourceInfo = {
          fileName: file.name,
          fileSize: file.size,
          lastModified: file.lastModified,
          extractedAt: Date.now(),
          gameVersion: parsedData.gameVersion,
        }

        // Cache for future sessions
        saveJarCatalogCache(catalog, sourceInfo)

        // Update application state
        dispatch({
          type: 'SET_CATALOG',
          catalog,
          source: 'jar_user',
        })

        // Update status with file name
        dispatch({
          type: 'SET_CATALOG_STATUS',
          status: {
            jarFileName: file.name,
          } as Partial<CatalogStatus>,
        })

        // Track successful JAR import
        capture('jar_import_success', {
          file_size: file.size,
          game_version: parsedData.gameVersion ?? null,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error parsing JAR file'

        dispatch({
          type: 'SET_CATALOG_STATUS',
          status: {
            lastError: `Failed to parse JAR: ${message}`,
            isParsing: false,
          } as Partial<CatalogStatus>,
        })

        capture('jar_import_error')
      }
    },
    [dispatch]
  )

  /**
   * Open file selection dialog
   */
  const selectJarFile = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  /**
   * Handle file input change
   */
  const onFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        void handleJarFile(file)
      }
      // Reset input so the same file can be selected again
      event.target.value = ''
    },
    [handleJarFile]
  )

  return {
    selectJarFile,
    handleJarFile,
    fileInputRef,
    onFileInputChange,
  }
}
