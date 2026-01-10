import { useMemo, useState, useSyncExternalStore, useEffect } from 'react'
import { usePlanner } from '../state'
import { GRID_PRESETS, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from '@/data/presets'
import type { ToolId } from '@/data/types'
import { Select, type SelectOption } from '@/components'
import { calculateFitZoomForViewport } from '../zoom'
import styles from './Toolbar.module.css'

interface ToolButtonProps {
  id: string
  label: string
  active: boolean
  onClick: () => void
}

function ToolButton({ id, label, active, onClick }: ToolButtonProps) {
  return (
    <button className={styles.toolButton} data-active={active} onClick={onClick} title={id}>
      {label}
    </button>
  )
}

/** Subscribe to window resize events */
function subscribeToResize(callback: () => void) {
  window.addEventListener('resize', callback)
  return () => window.removeEventListener('resize', callback)
}

/** Get current viewport width */
function getViewportWidth() {
  return window.innerWidth
}

export function Toolbar() {
  const { state, dispatch } = usePlanner()
  const { presetLabel, zoom, showGrid, tool, gridSize } = state

  // Subscribe to viewport width changes for dynamic 100% calculation
  const viewportWidth = useSyncExternalStore(subscribeToResize, getViewportWidth)

  // Calculate the zoom that represents 100% (fit-to-width)
  const fitZoom = useMemo(
    () => calculateFitZoomForViewport(gridSize.width, viewportWidth),
    [gridSize.width, viewportWidth]
  )

  // Convert current zoom to percentage relative to fit-to-width zoom
  const zoomPercent = Math.round((zoom / fitZoom) * 100)

  // Local state for zoom input editing
  const [zoomInputValue, setZoomInputValue] = useState(String(zoomPercent))
  const [isEditingZoom, setIsEditingZoom] = useState(false)

  // Sync input value with actual zoom when not editing
  useEffect(() => {
    if (!isEditingZoom) {
      setZoomInputValue(String(zoomPercent))
    }
  }, [zoomPercent, isEditingZoom])

  // Build select options from presets
  const presetOptions: SelectOption[] = useMemo(
    () =>
      GRID_PRESETS.map((preset) => ({
        value: preset.label,
        label: `${preset.label} (${preset.width}×${preset.height})`,
      })),
    []
  )

  const handlePresetChange = (value: string) => {
    const preset = GRID_PRESETS.find((p) => p.label === value)
    if (preset) {
      dispatch({
        type: 'SET_PRESET',
        presetLabel: preset.label,
        gridSize: { width: preset.width, height: preset.height },
      })
    }
  }

  const handleZoomIn = () => {
    const newZoom = Math.min(zoom + ZOOM_STEP, ZOOM_MAX)
    dispatch({ type: 'SET_ZOOM', zoom: newZoom })
  }

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom - ZOOM_STEP, ZOOM_MIN)
    dispatch({ type: 'SET_ZOOM', zoom: newZoom })
  }

  const handleToolChange = (newTool: ToolId) => {
    dispatch({ type: 'SET_TOOL', tool: newTool })
  }

  const handleGridToggle = () => {
    dispatch({ type: 'TOGGLE_GRID' })
  }

  const handleZoomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZoomInputValue(e.target.value)
  }

  const handleZoomInputFocus = () => {
    setIsEditingZoom(true)
  }

  const handleZoomInputBlur = () => {
    setIsEditingZoom(false)
    applyZoomFromInput()
  }

  const handleZoomInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setZoomInputValue(String(zoomPercent))
      setIsEditingZoom(false)
      e.currentTarget.blur()
    }
  }

  const applyZoomFromInput = () => {
    const parsedPercent = parseInt(zoomInputValue, 10)
    if (!isNaN(parsedPercent) && parsedPercent > 0) {
      // Convert percentage back to zoom (pixels per tile)
      const newZoom = Math.round((parsedPercent / 100) * fitZoom)
      // Clamp to valid range
      const clampedZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom))
      dispatch({ type: 'SET_ZOOM', zoom: clampedZoom })
    }
  }

  const canZoomOut = zoom > ZOOM_MIN
  const canZoomIn = zoom < ZOOM_MAX

  return (
    <div className={styles.toolbar}>
      {/* Canvas preset */}
      <div className={styles.group}>
        <span className={styles.label}>Canvas:</span>
        <Select
          options={presetOptions}
          value={presetLabel}
          onChange={handlePresetChange}
          aria-label="Canvas size"
        />
      </div>

      {/* Zoom */}
      <div className={styles.zoomControl}>
        <button
          className={styles.zoomButton}
          onClick={handleZoomOut}
          disabled={!canZoomOut}
          title="Zoom out (-)"
          aria-label="Zoom out"
        >
          −
        </button>
        <div className={styles.zoomInputWrapper}>
          <input
            type="text"
            className={styles.zoomInput}
            value={zoomInputValue}
            onChange={handleZoomInputChange}
            onFocus={handleZoomInputFocus}
            onBlur={handleZoomInputBlur}
            onKeyDown={handleZoomInputKeyDown}
            aria-label="Zoom percentage"
          />
          <span className={styles.zoomSuffix}>%</span>
        </div>
        <button
          className={styles.zoomButton}
          onClick={handleZoomIn}
          disabled={!canZoomIn}
          title="Zoom in (+)"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>

      {/* Tools */}
      <div className={styles.group}>
        <ToolButton
          id="hull"
          label="🧱 Hull"
          active={tool === 'hull'}
          onClick={() => handleToolChange('hull')}
        />
        <ToolButton
          id="place"
          label="✏️ Place"
          active={tool === 'place'}
          onClick={() => handleToolChange('place')}
        />
        <ToolButton
          id="erase"
          label="🗑️ Erase"
          active={tool === 'erase'}
          onClick={() => handleToolChange('erase')}
        />
        <ToolButton
          id="grid"
          label="🔲 Grid"
          active={showGrid}
          onClick={handleGridToggle}
        />
      </div>
    </div>
  )
}
