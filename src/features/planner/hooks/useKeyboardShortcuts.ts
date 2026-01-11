import { useEffect, useCallback } from 'react'
import type { Dispatch } from 'react'
import type { PlannerAction, PlannerState } from '../state/types'
import { ZOOM_STEP } from '@/data/presets'
import { calculateFitZoomForViewport } from '../zoom'

/**
 * Hook to handle keyboard shortcuts for the planner
 *
 * @param dispatch - The planner dispatch function
 * @param zoom - Current zoom level (pixels per tile)
 * @param gridWidth - The grid width in tiles
 * @param canvasContentWidth - The measured content width of the canvas container (in pixels)
 */
export function useKeyboardShortcuts(
  dispatch: Dispatch<PlannerAction>,
  zoom: PlannerState['zoom'],
  gridWidth: number,
  canvasContentWidth: number
) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      // Zoom reset with Ctrl/Cmd+0 (reset to 100%)
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault()
        const fitZoom = calculateFitZoomForViewport(gridWidth, canvasContentWidth)
        dispatch({ type: 'SET_ZOOM', zoom: fitZoom })
        return
      }

      // Zoom with Ctrl/Cmd modifier
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_')
      ) {
        e.preventDefault()
        if (e.key === '+' || e.key === '=') {
          dispatch({ type: 'SET_ZOOM', zoom: zoom + ZOOM_STEP })
        } else {
          dispatch({ type: 'SET_ZOOM', zoom: zoom - ZOOM_STEP })
        }
        return
      }

      switch (e.key) {
        // Zoom reset (without modifier) - reset to 100%
        case '0':
          e.preventDefault()
          const fitZoom = calculateFitZoomForViewport(gridWidth, canvasContentWidth)
          dispatch({ type: 'SET_ZOOM', zoom: fitZoom })
          break

        // Zoom (without modifier)
        case '+':
        case '=':
          e.preventDefault()
          dispatch({ type: 'SET_ZOOM', zoom: zoom + ZOOM_STEP })
          break
        case '-':
        case '_':
          e.preventDefault()
          dispatch({ type: 'SET_ZOOM', zoom: zoom - ZOOM_STEP })
          break

        // Rotation
        case 'q':
        case 'Q':
          e.preventDefault()
          dispatch({ type: 'ROTATE_PREVIEW', direction: 'ccw' })
          break
        case 'e':
        case 'E':
          e.preventDefault()
          dispatch({ type: 'ROTATE_PREVIEW', direction: 'cw' })
          break

        // Tools
        case '1':
          e.preventDefault()
          dispatch({ type: 'SET_TOOL', tool: 'hull' })
          break
        case '2':
          e.preventDefault()
          dispatch({ type: 'SET_TOOL', tool: 'place' })
          break
        case '3':
          e.preventDefault()
          dispatch({ type: 'SET_TOOL', tool: 'erase' })
          break

        // Clear selection
        case 'Escape':
          e.preventDefault()
          dispatch({ type: 'CLEAR_SELECTION' })
          break
      }
    },
    [dispatch, zoom, gridWidth, canvasContentWidth]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
