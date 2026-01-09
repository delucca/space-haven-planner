import { usePlannerState } from '../state'
import styles from './StatusBar.module.css'

export function StatusBar() {
  const state = usePlannerState()
  const { hoveredTile, structures, gridSize } = state

  return (
    <div className={styles.statusBar}>
      <span className={styles.left}>
        {hoveredTile
          ? `Cursor: ${hoveredTile.x}, ${hoveredTile.y}`
          : 'Hover over grid to see coordinates'}
      </span>
      <span className={styles.right}>
        Structures: {structures.length} | Grid: {gridSize.width}×{gridSize.height}
      </span>
    </div>
  )
}



