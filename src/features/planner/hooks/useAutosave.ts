import { useEffect, useRef, useCallback } from 'react'
import type { Dispatch } from 'react'
import type { PlannerState, PlannerAction } from '../state/types'
import {
  createProjectFile,
  parseProjectFile,
  deserializeStructures,
  deserializeHullTiles,
  deserializeUserLayers,
  deserializeUserGroups,
} from '@/lib/serialization'

const STORAGE_KEY = 'space-haven-planner-autosave'
const DEBOUNCE_MS = 1000

/**
 * Hook to handle autosave to localStorage
 */
export function useAutosave(state: PlannerState, dispatch: Dispatch<PlannerAction>) {
  const timeoutRef = useRef<number | null>(null)
  const isInitializedRef = useRef(false)

  // Save to localStorage (debounced)
  const save = useCallback(() => {
    const project = createProjectFile(
      state.gridSize,
      state.presetLabel,
      state.structures,
      state.hullTiles,
      state.userLayers,
      state.userGroups,
      state.activeLayerId
    )
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
    } catch (err) {
      console.warn('Failed to autosave to localStorage:', err)
    }
  }, [
    state.gridSize,
    state.presetLabel,
    state.structures,
    state.hullTiles,
    state.userLayers,
    state.userGroups,
    state.activeLayerId,
  ])

  // Debounced save effect
  useEffect(() => {
    // Skip initial save on mount
    if (!isInitializedRef.current) {
      isInitializedRef.current = true
      return
    }

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = window.setTimeout(save, DEBOUNCE_MS)

    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [save])

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) return

      const data = JSON.parse(saved)
      const project = parseProjectFile(data)

      dispatch({
        type: 'SET_PRESET',
        presetLabel: project.preset,
        gridSize: project.gridSize,
      })

      const structures = deserializeStructures(project.structures)
      dispatch({ type: 'LOAD_STRUCTURES', structures })

      // Load hull tiles (v3+)
      const hullTiles = deserializeHullTiles(project.hullTiles)
      dispatch({ type: 'LOAD_HULL_TILES', tiles: hullTiles })

      // Load user layers and groups (v4+)
      const userLayers = deserializeUserLayers(project.userLayers)
      const userGroups = deserializeUserGroups(project.userGroups)
      dispatch({
        type: 'LOAD_USER_LAYERS',
        layers: userLayers,
        groups: userGroups,
        activeLayerId: project.activeLayerId,
      })
    } catch (err) {
      console.warn('Failed to load autosave from localStorage:', err)
    }
  }, [dispatch])
}

/**
 * Clear autosave from localStorage
 */
export function clearAutosave(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.warn('Failed to clear autosave:', err)
  }
}
