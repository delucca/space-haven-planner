import { useRef, useCallback } from 'react'
import { usePlanner } from '../state'
import { exportToPNG } from '../canvas'
import { clearAutosave } from '../hooks'
import { EXPORT_SCALE } from '@/data/presets'
import {
  createProjectFile,
  downloadProjectJSON,
  loadProjectFromFile,
  downloadDataURL,
  deserializeStructures,
} from '@/lib/serialization'
import styles from './ActionBar.module.css'

export function ActionBar() {
  const { state, dispatch } = usePlanner()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSave = useCallback(() => {
    const project = createProjectFile(state.gridSize, state.presetLabel, state.structures)
    downloadProjectJSON(project)
  }, [state.gridSize, state.presetLabel, state.structures])

  const handleLoadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      try {
        const project = await loadProjectFromFile(file)

        // Load the project into state
        dispatch({
          type: 'SET_PRESET',
          presetLabel: project.preset,
          gridSize: project.gridSize,
        })

        const structures = deserializeStructures(project.structures)
        dispatch({ type: 'LOAD_STRUCTURES', structures })
      } catch (err) {
        console.error('Failed to load project:', err)
        alert(`Failed to load project: ${err instanceof Error ? err.message : String(err)}`)
      }

      // Reset file input
      e.target.value = ''
    },
    [dispatch]
  )

  const handleExportPNG = useCallback(() => {
    try {
      const dataURL = exportToPNG(
        state.gridSize,
        state.structures,
        state.catalog,
        state.visibleLayers,
        EXPORT_SCALE
      )
      downloadDataURL(dataURL, 'spacehaven-ship.png')
    } catch (err) {
      console.error('Failed to export PNG:', err)
      alert('Failed to export PNG')
    }
  }, [state.gridSize, state.structures, state.catalog, state.visibleLayers])

  const handleClear = useCallback(() => {
    if (state.structures.length === 0) return

    const confirmed = window.confirm(
      'Are you sure you want to clear all structures? This cannot be undone.'
    )
    if (confirmed) {
      dispatch({ type: 'CLEAR_ALL_STRUCTURES' })
    }
  }, [state.structures.length, dispatch])

  const handleNewProject = useCallback(() => {
    if (state.structures.length === 0) {
      dispatch({ type: 'NEW_PROJECT' })
      clearAutosave()
      return
    }

    const confirmed = window.confirm(
      'Are you sure you want to start a new project? All unsaved changes will be lost.'
    )
    if (confirmed) {
      dispatch({ type: 'NEW_PROJECT' })
      clearAutosave()
    }
  }, [state.structures.length, dispatch])

  return (
    <div className={styles.actionBar}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <div className={styles.group}>
        <button className={styles.button} onClick={handleNewProject}>
          📄 New
        </button>
        <button className={styles.button} onClick={handleSave}>
          💾 Save
        </button>
        <button className={styles.button} onClick={handleLoadClick}>
          📂 Load
        </button>
      </div>

      <div className={styles.group}>
        <button className={styles.button} onClick={handleExportPNG}>
          🖼️ Export PNG
        </button>
      </div>

      <div className={styles.group}>
        <button className={styles.buttonDanger} onClick={handleClear}>
          🗑️ Clear All
        </button>
      </div>
    </div>
  )
}

