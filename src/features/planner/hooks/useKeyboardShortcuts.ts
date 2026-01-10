import { useEffect, useCallback } from 'react'
import type { Dispatch } from 'react'
import type { PlannerAction, PlannerState } from '../state/types'
import { ZOOM_STEP } from '@/data/presets'

/**
 * Hook to handle keyboard shortcuts for the planner
 */
export function useKeyboardShortcuts(dispatch: Dispatch<PlannerAction>, zoom: PlannerState['zoom']) {
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

      // Zoom with Ctrl/Cmd modifier
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_')) {
        e.preventDefault()
        if (e.key === '+' || e.key === '=') {
          dispatch({ type: 'SET_ZOOM', zoom: zoom + ZOOM_STEP })
        } else {
          dispatch({ type: 'SET_ZOOM', zoom: zoom - ZOOM_STEP })
        }
        return
      }

      switch (e.key) {
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
          dispatch({ type: 'SET_TOOL', tool: 'place' })
          break
        case '2':
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
    [dispatch, zoom]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
