/**
 * Hook for handling Space Haven save file import
 *
 * Provides functionality to:
 * - Parse user-uploaded save files
 * - List player-owned ships
 * - Convert ship layouts to planner state
 * - Handle import flow state
 */

import { useCallback, useRef, useState } from 'react'
import type { Dispatch } from 'react'
import type { PlannerAction } from '@/features/planner/state/types'
import type { StructureCatalog } from '@/data/types'
import {
  loadSaveFile,
  parseShipById,
  convertShipToPlannerState,
  type SaveParseResult,
  type ShipConversionResult,
} from '@/data/saveGame'
import { capture } from '@/lib/analytics'

/**
 * State for the save import flow
 */
export interface SaveImportState {
  /** Whether the import dialog is open */
  isDialogOpen: boolean
  /** Whether we're currently loading/parsing */
  isLoading: boolean
  /** Error message if something went wrong */
  error: string | null
  /** Parsed save result (ships list) */
  parseResult: SaveParseResult | null
  /** Conversion result after importing a ship */
  conversionResult: ShipConversionResult | null
}

/**
 * Return type for the useSaveImport hook
 */
export interface SaveImportResult {
  /** Current state of the import flow */
  state: SaveImportState
  /** Open the import dialog */
  openDialog: () => void
  /** Close the import dialog */
  closeDialog: () => void
  /** Trigger file selection */
  selectFile: () => void
  /** Import a specific ship from the parsed save */
  importShip: (shipSid: string, parseResult: SaveParseResult) => Promise<ShipConversionResult>
  /** Reset the import state (for starting over) */
  reset: () => void
  /** Reference to the hidden file input */
  fileInputRef: React.RefObject<HTMLInputElement | null>
  /** Handle file input change */
  onFileInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}

const initialState: SaveImportState = {
  isDialogOpen: false,
  isLoading: false,
  error: null,
  parseResult: null,
  conversionResult: null,
}

/**
 * Hook for importing ships from Space Haven save files
 */
export function useSaveImport(
  dispatch: Dispatch<PlannerAction>,
  catalog: StructureCatalog
): SaveImportResult {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [state, setState] = useState<SaveImportState>(initialState)

  /**
   * Open the import dialog
   */
  const openDialog = useCallback(() => {
    setState((prev) => ({ ...prev, isDialogOpen: true }))
  }, [])

  /**
   * Close the import dialog
   */
  const closeDialog = useCallback(() => {
    setState(initialState)
  }, [])

  /**
   * Reset the import state (keep dialog open)
   */
  const reset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isLoading: false,
      error: null,
      parseResult: null,
      conversionResult: null,
    }))
  }, [])

  /**
   * Handle a save file and parse it
   */
  const handleSaveFile = useCallback(async (file: File) => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      parseResult: null,
      conversionResult: null,
    }))

    try {
      const result = await loadSaveFile(file)

      if (result.playerShips.length === 0) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            'No player-owned ships found in this save file. Make sure you selected the correct file.',
        }))
        capture('save_import_no_ships')
        return
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        parseResult: result,
      }))

      capture('save_import_parsed', {
        player_ships_count: result.playerShips.length,
        total_ships_count: result.allShips.length,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error parsing save file'
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: `Failed to parse save file: ${message}`,
      }))
      capture('save_import_parse_error')
    }
  }, [])

  /**
   * Import a specific ship from the parsed save
   */
  const importShip = useCallback(
    async (shipSid: string, parseResult: SaveParseResult): Promise<ShipConversionResult> => {
      const ship = parseShipById(parseResult.xmlDoc, shipSid)

      if (!ship) {
        throw new Error(`Ship with ID ${shipSid} not found in save`)
      }

      // Convert the ship to planner state
      const conversionResult = convertShipToPlannerState(ship, catalog)

      // Load into planner state
      dispatch({
        type: 'SET_PRESET',
        presetLabel: conversionResult.preset.label,
        gridSize: conversionResult.gridSize,
      })

      // Convert hull tiles to the format expected by the reducer
      dispatch({
        type: 'LOAD_HULL_TILES',
        tiles: [...conversionResult.hullTiles],
      })

      // Load structures
      dispatch({
        type: 'LOAD_STRUCTURES',
        structures: [...conversionResult.structures],
      })

      // Update state with result
      setState((prev) => ({
        ...prev,
        conversionResult,
      }))

      // Track successful import
      capture('save_import_success', {
        ship_name: ship.meta.name,
        ship_width: ship.meta.width,
        ship_height: ship.meta.height,
        hull_tiles: conversionResult.stats.hullTilesCreated,
        structures: conversionResult.stats.structuresCreated,
        unknown_mids: conversionResult.stats.unknownMids,
        preset: conversionResult.preset.label,
      })

      return conversionResult
    },
    [catalog, dispatch]
  )

  /**
   * Trigger file selection dialog
   */
  const selectFile = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  /**
   * Handle file input change
   */
  const onFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        void handleSaveFile(file)
      }
      // Reset input so the same file can be selected again
      event.target.value = ''
    },
    [handleSaveFile]
  )

  return {
    state,
    openDialog,
    closeDialog,
    selectFile,
    importShip,
    reset,
    fileInputRef,
    onFileInputChange,
  }
}



