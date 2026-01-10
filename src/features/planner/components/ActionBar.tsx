import { useRef, useCallback, useState } from 'react'
import { usePlanner } from '../state'
import { exportToPNG } from '../canvas'
import { clearAutosave, useJarImport } from '../hooks'
import { EXPORT_SCALE } from '@/data/presets'
import {
  createProjectFile,
  downloadProjectJSON,
  loadProjectFromFile,
  downloadDataURL,
  deserializeStructures,
} from '@/lib/serialization'
import { clearJarCatalogCache } from '@/data/jarCatalog'
import { JarImportDialog } from './JarImportDialog'
import styles from './ActionBar.module.css'

export function ActionBar() {
  const { state, dispatch } = usePlanner()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { selectJarFile, fileInputRef: jarInputRef, onFileInputChange: onJarInputChange } = useJarImport(dispatch)
  const [isJarDialogOpen, setIsJarDialogOpen] = useState(false)

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

  const handleResetCatalog = useCallback(() => {
    const confirmed = window.confirm(
      'Reset to built-in catalog? This will clear your uploaded JAR data.'
    )
    if (confirmed) {
      clearJarCatalogCache()
      dispatch({ type: 'RESET_TO_BUILTIN_CATALOG' })
    }
  }, [dispatch])

  // Check if user has uploaded a JAR
  const hasUserJar = state.catalogStatus.source === 'jar_user' ||
    state.catalogStatus.source === 'jar_user_cache'

  const handleOpenJarDialog = useCallback(() => {
    setIsJarDialogOpen(true)
  }, [])

  const handleCloseJarDialog = useCallback(() => {
    setIsJarDialogOpen(false)
  }, [])

  return (
    <div className={styles.actionBar}>
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <input
        ref={jarInputRef}
        type="file"
        accept=".jar"
        onChange={onJarInputChange}
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
        <button
          className={styles.button}
          onClick={handleOpenJarDialog}
          disabled={state.catalogStatus.isParsing}
          title="Upload your spacehaven.jar to update the catalog with your game version"
        >
          {state.catalogStatus.isParsing ? '⏳ Parsing...' : '📦 Import JAR'}
        </button>
        {hasUserJar && (
          <button
            className={styles.button}
            onClick={handleResetCatalog}
            title="Reset to the built-in catalog"
          >
            ↩️ Reset Catalog
          </button>
        )}
      </div>

      <JarImportDialog
        isOpen={isJarDialogOpen}
        isParsing={state.catalogStatus.isParsing}
        onClose={handleCloseJarDialog}
        onSelectFile={selectJarFile}
      />

      <div className={styles.group}>
        <button className={styles.buttonDanger} onClick={handleClear}>
          🗑️ Clear All
        </button>
      </div>
    </div>
  )
}
