import type { StructureDef, StructureCategory, TileLayout } from '@/data/types'
import type { WikiStructureMetadata, WikiStructureLookupStatus } from '@/data/catalog/wikiMetadata'
import styles from './StructureInfoPopover.module.css'

/**
 * Props for StructureInfoCard
 */
export interface StructureInfoCardProps {
  /** Structure definition from catalog */
  structure: StructureDef
  /** Category the structure belongs to */
  category: StructureCategory
  /** Wiki metadata lookup status */
  wikiStatus: WikiStructureLookupStatus
  /** Wiki metadata if found */
  wikiMetadata: WikiStructureMetadata | null
  /** Whether to show extended details (for placement panel) */
  extended?: boolean
}

/**
 * Count tiles by type in a tile layout
 */
function countTilesByType(layout: TileLayout): {
  construction: number
  blocked: number
  access: number
} {
  const counts = { construction: 0, blocked: 0, access: 0 }
  for (const tile of layout.tiles) {
    counts[tile.type]++
  }
  return counts
}

/**
 * Reusable card displaying structure info with optional wiki data
 *
 * Shows:
 * - Always: name, category, size
 * - If extended: tile layout stats (when available)
 * - If wiki found: image, description, "Open on wiki" button
 * - If wiki missing: no wiki UI (graceful degradation)
 */
export function StructureInfoCard({
  structure,
  category,
  wikiStatus,
  wikiMetadata,
  extended = false,
}: StructureInfoCardProps) {
  const hasWiki = wikiStatus === 'found' && wikiMetadata !== null
  const isLoading = wikiStatus === 'loading'

  // Calculate tile stats if available
  const tileStats = structure.tileLayout ? countTilesByType(structure.tileLayout) : null

  return (
    <div className={styles.card} data-extended={extended || undefined}>
      {/* Wiki image (if available) */}
      {hasWiki && wikiMetadata.imageUrl && (
        <div className={styles.imageContainer}>
          <img
            src={wikiMetadata.imageUrl}
            alt={structure.name}
            className={styles.image}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              // Hide broken image container on load failure
              const container = e.currentTarget.parentElement
              if (container) container.style.display = 'none'
            }}
          />
        </div>
      )}

      {/* Header: name + color swatch */}
      <div className={styles.header}>
        <span className={styles.colorSwatch} style={{ backgroundColor: structure.color }} />
        <span className={styles.name}>{structure.name}</span>
      </div>

      {/* Basic info */}
      <div className={styles.info}>
        <div className={styles.infoRow}>
          <span className={styles.label}>Category</span>
          <span className={styles.value}>{category.name}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Size</span>
          <span className={styles.value}>
            {structure.size[0]}×{structure.size[1]} tiles
          </span>
        </div>
      </div>

      {/* Extended: tile layout stats */}
      {extended && tileStats && (
        <div className={styles.tileStats}>
          <span className={styles.label}>Tiles</span>
          <div className={styles.tileCounts}>
            <span className={styles.tileCount} data-type="construction">
              {tileStats.construction} construction
            </span>
            {tileStats.blocked > 0 && (
              <span className={styles.tileCount} data-type="blocked">
                {tileStats.blocked} blocked
              </span>
            )}
            {tileStats.access > 0 && (
              <span className={styles.tileCount} data-type="access">
                {tileStats.access} access
              </span>
            )}
          </div>
        </div>
      )}

      {/* Wiki description */}
      {hasWiki && wikiMetadata.description && (
        <p className={styles.description}>{wikiMetadata.description}</p>
      )}

      {/* Loading indicator */}
      {isLoading && <div className={styles.loading}>Loading wiki info...</div>}

      {/* Wiki link button (only if wiki page exists) */}
      {hasWiki && (
        <a
          href={wikiMetadata.pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.wikiLink}
        >
          Open on Wiki ↗
        </a>
      )}
    </div>
  )
}

