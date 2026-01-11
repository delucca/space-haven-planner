import { useState, useEffect } from 'react'
import type { StructureDef, StructureCategory, TileLayout } from '@/data/types'
import type { WikiStructureMetadata, WikiStructureLookupStatus } from '@/data/catalog/wikiMetadata'
import styles from './StructureInfoPopover.module.css'

/**
 * WikiImage component that fetches images via fetch() to bypass referrer issues.
 * Fandom's CDN sometimes blocks images based on referrer, so we fetch as blob
 * and create an object URL.
 */
function WikiImage({
  src,
  alt,
  className,
  containerClassName,
}: {
  src: string
  alt: string
  className?: string
  containerClassName?: string
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    const fetchImage = async () => {
      try {
        // Fetch the image with no referrer to bypass hotlink protection
        const response = await fetch(src, {
          referrerPolicy: 'no-referrer',
          mode: 'cors',
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const blob = await response.blob()
        
        if (cancelled) return

        objectUrl = URL.createObjectURL(blob)
        setBlobUrl(objectUrl)
        setStatus('loaded')
      } catch (error) {
        if (cancelled) return
        console.warn('[WikiImage] Failed to fetch:', src, error)
        setStatus('error')
      }
    }

    fetchImage()

    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [src])

  // Don't render container if image failed to load
  if (status === 'error') {
    return null
  }

  // Show loading state while fetching
  if (status === 'loading' || !blobUrl) {
    return (
      <div className={containerClassName}>
        <div className={styles.imageLoading}>Loading...</div>
      </div>
    )
  }

  return (
    <div className={containerClassName}>
      <img
        src={blobUrl}
        alt={alt}
        className={className}
      />
    </div>
  )
}

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
        <WikiImage
          src={wikiMetadata.imageUrl}
          alt={structure.name}
          className={styles.image}
          containerClassName={styles.imageContainer}
        />
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

