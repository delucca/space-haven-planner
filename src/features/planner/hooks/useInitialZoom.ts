import { useEffect, useRef } from 'react'
import type { Dispatch } from 'react'
import type { PlannerAction } from '../state/types'
import { calculateFitZoomForViewport } from '../zoom'

/**
 * Calculate and set the initial zoom level to fit the grid width within the viewport.
 * Runs on mount and whenever gridWidth changes.
 *
 * @param dispatch - The planner dispatch function
 * @param gridWidth - The grid width in tiles
 * @param canvasContentWidth - The measured content width of the canvas container (in pixels)
 */
export function useInitialZoom(
  dispatch: Dispatch<PlannerAction>,
  gridWidth: number,
  canvasContentWidth: number
): void {
  const lastGridWidthRef = useRef<number | null>(null)
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    // Wait for canvas to be measured
    if (canvasContentWidth <= 0) return

    // On first valid measurement, set initial zoom
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      lastGridWidthRef.current = gridWidth
      const fitZoom = calculateFitZoomForViewport(gridWidth, canvasContentWidth)
      dispatch({ type: 'SET_ZOOM', zoom: fitZoom })
      return
    }

    // Only recalculate if gridWidth changed (e.g., preset change)
    if (lastGridWidthRef.current === gridWidth) return
    lastGridWidthRef.current = gridWidth

    const fitZoom = calculateFitZoomForViewport(gridWidth, canvasContentWidth)
    dispatch({ type: 'SET_ZOOM', zoom: fitZoom })
  }, [dispatch, gridWidth, canvasContentWidth])
}
