import { useEffect, useRef } from 'react'
import type { Dispatch } from 'react'
import type { PlannerAction } from '../state/types'
import { calculateFitZoomForViewport } from '../zoom'

/**
 * Calculate and set the initial zoom level to fit the grid width within the viewport.
 * Runs on mount and whenever gridWidth changes.
 */
export function useInitialZoom(dispatch: Dispatch<PlannerAction>, gridWidth: number): void {
  const lastGridWidthRef = useRef<number | null>(null)

  useEffect(() => {
    // Only recalculate if gridWidth changed (handles both initial mount and NEW_PROJECT)
    if (lastGridWidthRef.current === gridWidth) return
    lastGridWidthRef.current = gridWidth

    const fitZoom = calculateFitZoomForViewport(gridWidth, window.innerWidth)
    dispatch({ type: 'SET_ZOOM', zoom: fitZoom })
  }, [dispatch, gridWidth])
}

