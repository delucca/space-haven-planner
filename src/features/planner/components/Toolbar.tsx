import { usePlanner } from '../state'
import { GRID_PRESETS, ZOOM_MIN, ZOOM_MAX } from '@/data/presets'
import type { ToolId } from '@/data/types'
import styles from './Toolbar.module.css'

interface ToolButtonProps {
  id: ToolId
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

export function Toolbar() {
  const { state, dispatch } = usePlanner()
  const { presetLabel, zoom, showGrid, tool } = state

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = GRID_PRESETS.find((p) => p.label === e.target.value)
    if (preset) {
      dispatch({
        type: 'SET_PRESET',
        presetLabel: preset.label,
        gridSize: { width: preset.width, height: preset.height },
      })
    }
  }

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_ZOOM', zoom: parseInt(e.target.value, 10) })
  }

  const handleToolChange = (newTool: ToolId) => {
    dispatch({ type: 'SET_TOOL', tool: newTool })
  }

  const handleGridToggle = () => {
    dispatch({ type: 'TOGGLE_GRID' })
  }

  return (
    <div className={styles.toolbar}>
      {/* Canvas preset */}
      <div className={styles.group}>
        <label className={styles.label}>Canvas:</label>
        <select className={styles.select} value={presetLabel} onChange={handlePresetChange}>
          {GRID_PRESETS.map((preset) => (
            <option key={preset.label} value={preset.label}>
              {preset.label} ({preset.width}×{preset.height})
            </option>
          ))}
        </select>
      </div>

      {/* Zoom */}
      <div className={styles.group}>
        <label className={styles.label}>Zoom:</label>
        <input
          type="range"
          className={styles.slider}
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          value={zoom}
          onChange={handleZoomChange}
        />
        <span className={styles.zoomValue}>{zoom}px</span>
      </div>

      {/* Tools */}
      <div className={styles.group}>
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
      </div>

      {/* Grid toggle */}
      <label className={styles.checkbox}>
        <input type="checkbox" checked={showGrid} onChange={handleGridToggle} />
        Grid
      </label>
    </div>
  )
}



