import { useEffect, useCallback } from 'react'
import type { Dispatch } from 'react'
import type { PlannerAction } from '../state/types'

/**
 * Hook to handle keyboard shortcuts for the planner
 */
export function useKeyboardShortcuts(dispatch: Dispatch<PlannerAction>) {
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

      switch (e.key.toLowerCase()) {
        // Rotation
        case 'q':
          e.preventDefault()
          dispatch({ type: 'ROTATE_PREVIEW', direction: 'ccw' })
          break
        case 'e':
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
        case 'escape':
          e.preventDefault()
          dispatch({ type: 'CLEAR_SELECTION' })
          break
      }
    },
    [dispatch]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}



