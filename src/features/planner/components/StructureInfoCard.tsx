import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { StructureDef, StructureCategory, TileLayout } from '@/data/types'
import type { WikiStructureMetadata, WikiStructureLookupStatus } from '@/data/catalog/wikiMetadata'
import styles from './StructureInfoPopover.module.css'

const WIKI_PROGRESS_PRE_COMPLETE_MAX = 90
const WIKI_PROGRESS_TICK_MS = 90
const WIKI_PROGRESS_DONE_HOLD_MS = 450

/**
 * WikiImage component that loads images from Fandom's CDN.
 *
 * IMPORTANT: Fandom returns a 404 placeholder image when a 3rd-party page sends a Referer header
 * (e.g. `http://localhost:5174/`). We must set `referrerPolicy="no-referrer"` to prevent hotlink blocking.
 */
function WikiImage({
  src,
  alt,
  className,
  containerClassName,
  onStatusChange,
}: {
  src: string
  alt: string
  className?: string
  containerClassName?: string
  onStatusChange?: (status: 'loading' | 'loaded' | 'error') => void
}) {
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    setHasError(false)
    onStatusChange?.('loading')
  }, [src])

  // If the image is already cached, onLoad can be skipped in some edge cases.
  useEffect(() => {
    const img = imgRef.current
    if (!img) return
    if (!img.complete) return
    onStatusChange?.(img.naturalWidth > 0 ? 'loaded' : 'error')
  }, [src])

  return (
    <div className={containerClassName}>
      {hasError ? (
        <div className={styles.imageLoading}>Image unavailable.</div>
      ) : (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className={className}
          referrerPolicy="no-referrer"
          onLoad={() => onStatusChange?.('loaded')}
          onError={() => {
            setHasError(true)
            onStatusChange?.('error')
          }}
        />
      )}
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
  const [imageStatus, setImageStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')

  const needsImage = useMemo(
    () => wikiStatus === 'found' && (wikiMetadata?.imageUrl ?? null) !== null,
    [wikiStatus, wikiMetadata?.imageUrl]
  )

  useEffect(() => {
    if (!needsImage) {
      setImageStatus('idle')
    }
  }, [needsImage])

  // Calculate tile stats if available
  const tileStats = structure.tileLayout ? countTilesByType(structure.tileLayout) : null

  // Progress bar state for wiki fetch (and image load, if applicable)
  const [progress, setProgress] = useState(0)
  const [barVisible, setBarVisible] = useState(false)
  const tickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (tickTimerRef.current) {
      clearTimeout(tickTimerRef.current)
      tickTimerRef.current = null
    }
    if (doneTimerRef.current) {
      clearTimeout(doneTimerRef.current)
      doneTimerRef.current = null
    }
  }, [])

  const isWikiLoading = wikiStatus === 'loading'
  const isImageLoading = needsImage && imageStatus === 'loading'
  const isFullyLoaded = !isWikiLoading && (!needsImage || imageStatus !== 'loading')

  // Start / advance fake progress while loading
  useEffect(() => {
    if (!isWikiLoading && !isImageLoading) {
      return
    }

    clearTimers()
    setBarVisible(true)
    setProgress(0)

    const tick = () => {
      setProgress((prev) => {
        if (prev >= WIKI_PROGRESS_PRE_COMPLETE_MAX) return prev
        const remaining = WIKI_PROGRESS_PRE_COMPLETE_MAX - prev
        // Ease-out towards the cap
        const next = prev + Math.max(1, Math.round(remaining * 0.12))
        return Math.min(WIKI_PROGRESS_PRE_COMPLETE_MAX, next)
      })
      tickTimerRef.current = setTimeout(tick, WIKI_PROGRESS_TICK_MS)
    }

    tickTimerRef.current = setTimeout(tick, WIKI_PROGRESS_TICK_MS)

    return () => {
      clearTimers()
    }
  }, [clearTimers, isWikiLoading, isImageLoading])

  // Complete and fade out once fully loaded (wiki + image if present)
  useEffect(() => {
    if (!barVisible) return
    if (!isFullyLoaded) return

    // Stop ticking and fill to 100%
    if (tickTimerRef.current) {
      clearTimeout(tickTimerRef.current)
      tickTimerRef.current = null
    }
    setProgress(100)

    // Keep visible briefly, then hide without layout shift (opacity transition)
    if (doneTimerRef.current) {
      clearTimeout(doneTimerRef.current)
    }
    doneTimerRef.current = setTimeout(() => {
      setBarVisible(false)
      doneTimerRef.current = null
    }, WIKI_PROGRESS_DONE_HOLD_MS)
  }, [barVisible, isFullyLoaded])

  return (
    <div className={styles.card} data-extended={extended || undefined}>
      {/* Wiki image (if available) */}
      {hasWiki && wikiMetadata.imageUrl && (
        <WikiImage
          src={wikiMetadata.imageUrl}
          alt={structure.name}
          className={styles.image}
          containerClassName={styles.imageContainer}
          onStatusChange={(s) => {
            if (s === 'loading') setImageStatus('loading')
            else if (s === 'loaded') setImageStatus('loaded')
            else setImageStatus('error')
          }}
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

      {/* Wiki fetch progress bar (bottom border, overlay) */}
      <div
        className={styles.wikiProgressBar}
        data-visible={barVisible || undefined}
        style={{ ['--wiki-progress' as string]: `${progress}%` }}
      >
        <div className={styles.wikiProgressFill} />
      </div>
    </div>
  )
}

