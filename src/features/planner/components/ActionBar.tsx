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
  deserializeHullTiles,
} from '@/lib/serialization'
import { clearJarCatalogCache } from '@/data/jarCatalog'
import { JarImportDialog } from './JarImportDialog'
import { ConfirmDialog } from './ConfirmDialog'
import styles from './ActionBar.module.css'

export function ActionBar() {
  const { state, dispatch } = usePlanner()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const {
    selectJarFile,
    fileInputRef: jarInputRef,
    onFileInputChange: onJarInputChange,
  } = useJarImport(dispatch)
  const [isJarDialogOpen, setIsJarDialogOpen] = useState(false)
  const [confirmKind, setConfirmKind] = useState<
    null | 'clear_all' | 'new_project' | 'reset_catalog'
  >(null)

  const handleSave = useCallback(() => {
    const project = createProjectFile(
      state.gridSize,
      state.presetLabel,
      state.structures,
      state.hullTiles
    )
    downloadProjectJSON(project)
  }, [state.gridSize, state.presetLabel, state.structures, state.hullTiles])

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

        // Load hull tiles (v3+)
        const hullTiles = deserializeHullTiles(project.hullTiles)
        dispatch({ type: 'LOAD_HULL_TILES', tiles: hullTiles })
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
        state.hullTiles,
        state.catalog,
        state.visibleLayers,
        EXPORT_SCALE
      )
      downloadDataURL(dataURL, 'spacehaven-ship.png')
    } catch (err) {
      console.error('Failed to export PNG:', err)
      alert('Failed to export PNG')
    }
  }, [state.gridSize, state.structures, state.hullTiles, state.catalog, state.visibleLayers])

  const handleClear = useCallback(() => {
    const hasAnything = state.structures.length > 0 || state.hullTiles.size > 0
    if (!hasAnything) return

    setConfirmKind('clear_all')
  }, [state.structures.length, state.hullTiles.size, dispatch])

  const handleNewProject = useCallback(() => {
    const hasAnything = state.structures.length > 0 || state.hullTiles.size > 0
    if (!hasAnything) {
      dispatch({ type: 'NEW_PROJECT' })
      clearAutosave()
      return
    }

    setConfirmKind('new_project')
  }, [state.structures.length, state.hullTiles.size, dispatch])

  const handleResetCatalog = useCallback(() => {
    setConfirmKind('reset_catalog')
  }, [dispatch])

  const handleCloseConfirm = useCallback(() => {
    setConfirmKind(null)
  }, [])

  const handleConfirm = useCallback(() => {
    if (confirmKind === 'clear_all') {
      dispatch({ type: 'CLEAR_ALL_STRUCTURES' })
      return
    }

    if (confirmKind === 'new_project') {
      dispatch({ type: 'NEW_PROJECT' })
      clearAutosave()
      return
    }

    if (confirmKind === 'reset_catalog') {
      clearJarCatalogCache()
      dispatch({ type: 'RESET_TO_BUILTIN_CATALOG' })
    }
  }, [confirmKind, dispatch])

  const confirmTitle =
    confirmKind === 'clear_all'
      ? '🗑️ Clear All'
      : confirmKind === 'new_project'
        ? '📄 New Project'
        : confirmKind === 'reset_catalog'
          ? '↩️ Reset Catalog'
          : ''

  const confirmMessage =
    confirmKind === 'clear_all'
      ? 'Are you sure you want to clear everything (structures + hull tiles)? This cannot be undone.'
      : confirmKind === 'new_project'
        ? 'Are you sure you want to start a new project? This will remove all structures and hull tiles, and any unsaved changes will be lost.'
        : confirmKind === 'reset_catalog'
          ? 'Reset to built-in catalog? This will clear your uploaded JAR data.'
          : ''

  const confirmLabel =
    confirmKind === 'clear_all'
      ? 'Clear All'
      : confirmKind === 'new_project'
        ? 'Start New'
        : confirmKind === 'reset_catalog'
          ? 'Reset'
          : 'Confirm'

  // Check if user has uploaded a JAR
  const hasUserJar =
    state.catalogStatus.source === 'jar_user' || state.catalogStatus.source === 'jar_user_cache'

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
      <ConfirmDialog
        isOpen={confirmKind !== null}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={confirmLabel}
        variant="danger"
        onClose={handleCloseConfirm}
        onConfirm={handleConfirm}
      />

      <div className={styles.group}>
        <button className={styles.buttonDanger} onClick={handleClear}>
          🗑️ Clear All
        </button>
      </div>
    </div>
  )
}
