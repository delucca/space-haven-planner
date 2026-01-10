import { useEffect, useRef } from 'react'
import type { Dispatch } from 'react'
import type { PlannerAction } from '../state/types'
import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from '@/data/presets'

// Layout constants (must match PlannerPage.module.css)
const LEFT_PANEL_WIDTH = 280
const RIGHT_PANEL_WIDTH = 320 // Updated to match larger right panel
const CANVAS_CONTAINER_PADDING = 24 * 2 // --spacing-xl on both sides
const CANVAS_BORDER = 2 * 2 // 2px border on both sides

/**
 * Calculate the fit-to-width zoom for a given grid width
 */
export function calculateFitZoom(gridWidth: number): number {
  const viewportWidth = window.innerWidth
  const availableWidth =
    viewportWidth -
    LEFT_PANEL_WIDTH -
    RIGHT_PANEL_WIDTH -
    CANVAS_CONTAINER_PADDING -
    CANVAS_BORDER

  // Calculate optimal zoom to fill the available width
  const optimalZoom = Math.floor(availableWidth / gridWidth)

  // Clamp to valid zoom range and snap to step
  const clampedZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, optimalZoom))
  const snappedZoom = Math.floor(clampedZoom / ZOOM_STEP) * ZOOM_STEP

  return snappedZoom
}

/**
 * Calculate and set the initial zoom level to fit the grid width within the viewport.
 * Runs on mount and whenever gridWidth changes (e.g., NEW_PROJECT).
 */
export function useInitialZoom(dispatch: Dispatch<PlannerAction>, gridWidth: number): void {
  const lastGridWidthRef = useRef<number | null>(null)

  useEffect(() => {
    // Only recalculate if gridWidth changed (handles both initial mount and NEW_PROJECT)
    if (lastGridWidthRef.current === gridWidth) return
    lastGridWidthRef.current = gridWidth

    const snappedZoom = calculateFitZoom(gridWidth)
    dispatch({ type: 'SET_ZOOM', zoom: snappedZoom })
  }, [dispatch, gridWidth])
}

