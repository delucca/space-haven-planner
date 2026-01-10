import { usePlannerState } from '../state'
import type { CatalogSource } from '../state/types'
import styles from './StatusBar.module.css'

/**
 * Format catalog source for display
 */
function formatCatalogSource(source: CatalogSource, jarFileName: string | null): string {
  switch (source) {
    case 'jar_builtin_snapshot':
      return 'JAR (built-in)'
    case 'jar_user':
      return jarFileName ? `JAR (${jarFileName})` : 'JAR (user)'
    case 'jar_user_cache':
      return jarFileName ? `JAR (${jarFileName}, cached)` : 'JAR (user, cached)'
  }
}

/**
 * Format relative time for display
 */
function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return ''

  const now = Date.now()
  const diffMs = now - timestamp
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

export function StatusBar() {
  const state = usePlannerState()
  const { hoveredTile, structures, gridSize, catalogStatus } = state

  const catalogLabel = formatCatalogSource(catalogStatus.source, catalogStatus.jarFileName)
  const lastUpdated = formatRelativeTime(catalogStatus.lastUpdatedAt)

  return (
    <div className={styles.statusBar}>
      <span className={styles.left}>
        {hoveredTile
          ? `Cursor: ${hoveredTile.x}, ${hoveredTile.y}`
          : 'Hover over grid to see coordinates'}
      </span>
      <span className={styles.center}>
        {catalogStatus.lastError && (
          <span className={styles.error} title={catalogStatus.lastError}>
            ⚠️ JAR parse failed
          </span>
        )}
        {catalogStatus.isParsing && (
          <span className={styles.refreshing}>Parsing JAR file...</span>
        )}
      </span>
      <span className={styles.right}>
        <span
          className={styles.catalogInfo}
          title={lastUpdated ? `Updated ${lastUpdated}` : undefined}
        >
          Catalog: {catalogLabel}
        </span>
        {' | '}
        Structures: {structures.length} | Grid: {gridSize.width}×{gridSize.height}
      </span>
    </div>
  )
}
