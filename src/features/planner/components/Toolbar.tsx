import { useMemo, useState } from 'react'
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

interface ToolbarProps {
  /** The measured content width of the canvas container (in pixels) */
  canvasContentWidth: number
}

export function Toolbar({ canvasContentWidth }: ToolbarProps) {
  const { state, dispatch } = usePlanner()
  const { presetLabel, width, height, zoom, showGrid, tool, gridSize } = state

  // Calculate the zoom that represents 100% (fit-to-width) using measured canvas width
  const fitZoom = useMemo(
    () => calculateFitZoomForViewport(gridSize.width, canvasContentWidth),
    [gridSize.width, canvasContentWidth]
  )

  // Convert current zoom to percentage relative to fit-to-width zoom
  const zoomPercent = fitZoom > 0 ? Math.round((zoom / fitZoom) * 100) : 100

  // Local state for zoom input editing - track if user is actively editing
  const [isEditingZoom, setIsEditingZoom] = useState(false)
  const [editingValue, setEditingValue] = useState('')

  // Derive displayed value: show editing value when editing, otherwise show computed percent
  const displayedZoomValue = isEditingZoom ? editingValue : String(zoomPercent)

  // Build select options from presets
  const presetOptions: SelectOption[] = useMemo(
    () =>
      GRID_PRESETS.map((preset) => ({
        value: preset.label,
        label: `${preset.label} (${preset.width * 27}×${preset.height * 27})`,
      })),
    []
  )

  const handlePresetChange = (value: string) => {
    const preset = GRID_PRESETS.find((p) => p.label === value)
    if (preset) {
      dispatch({
        type: 'SET_PRESET',
        presetLabel: preset.label,
        width: preset.width,
        height: preset.height,
        gridSize: { width: preset.width * 27, height: preset.height * 27 },
      })
    }
  }

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({
      type: 'SET_WIDTH',
      width: Number(e.target.value)
    })
  }

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({
      type: 'SET_HEIGHT',
      height: Number(e.target.value)
    })
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
    setEditingValue(e.target.value)
  }

  const handleZoomInputFocus = () => {
    setEditingValue(String(zoomPercent))
    setIsEditingZoom(true)
  }

  const handleZoomInputBlur = () => {
    applyZoomFromInput()
    setIsEditingZoom(false)
  }

  const handleZoomInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setIsEditingZoom(false)
      e.currentTarget.blur()
    }
  }

  const applyZoomFromInput = () => {
    const parsedPercent = parseInt(editingValue, 10)
    if (!isNaN(parsedPercent) && parsedPercent > 0 && fitZoom > 0) {
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

      {/* Canvas width */}
      <div className={styles.group}>
        <span className={styles.label}>Width:</span>
        <input
          type='number'
          className={styles.widthHeightInput}
          value={width}
          onChange={handleWidthChange}
          aria-label="Canvas width"
        />
      </div>      

      {/* Canvas height */}
      <div className={styles.group}>
        <span className={styles.label}>Height:</span>
        <input
          type='number'
          className={styles.widthHeightInput}
          value={height}
          onChange={handleHeightChange}
          aria-label="Canvas height"
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
            value={displayedZoomValue}
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
          id="select"
          label="🖱️ Select"
          active={tool === 'select'}
          onClick={() => handleToolChange('select')}
        />
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
        <ToolButton id="grid" label="🔲 Grid" active={showGrid} onClick={handleGridToggle} />
      </div>
    </div>
  )
}
