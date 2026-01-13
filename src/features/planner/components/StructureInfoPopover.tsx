import { createPortal } from 'react-dom'
import { useEffect, useState, useRef, useCallback } from 'react'
import { StructureInfoCard } from './StructureInfoCard'
import { useWikiStructureMetadata } from '../hooks'
import type { StructureDef, StructureCategory } from '@/data/types'
import styles from './StructureInfoPopover.module.css'

/**
 * Props for StructureInfoPopover
 */
export interface StructureInfoPopoverProps {
  /** Structure definition from catalog */
  structure: StructureDef
  /** Category the structure belongs to */
  category: StructureCategory
  /** Anchor position (client coordinates) */
  anchorX: number
  anchorY: number
  /** Callback when mouse enters the popover */
  onMouseEnter?: () => void
  /** Callback when mouse leaves the popover */
  onMouseLeave?: () => void
}

/** Padding from viewport edges */
const VIEWPORT_PADDING = 12

/** Offset from anchor point */
const ANCHOR_OFFSET = 8

/**
 * Calculate popover position to stay within viewport
 */
function calculatePosition(
  anchorX: number,
  anchorY: number,
  popoverWidth: number,
  popoverHeight: number
): { x: number; y: number } {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  // Start to the right and below the anchor
  let x = anchorX + ANCHOR_OFFSET
  let y = anchorY + ANCHOR_OFFSET

  // Flip to left if would overflow right edge
  if (x + popoverWidth + VIEWPORT_PADDING > viewportWidth) {
    x = anchorX - popoverWidth - ANCHOR_OFFSET
  }

  // Flip to above if would overflow bottom edge
  if (y + popoverHeight + VIEWPORT_PADDING > viewportHeight) {
    y = anchorY - popoverHeight - ANCHOR_OFFSET
  }

  // Clamp to viewport bounds
  x = Math.max(VIEWPORT_PADDING, Math.min(x, viewportWidth - popoverWidth - VIEWPORT_PADDING))
  y = Math.max(VIEWPORT_PADDING, Math.min(y, viewportHeight - popoverHeight - VIEWPORT_PADDING))

  return { x, y }
}

/**
 * Popover component that renders structure info via portal
 *
 * Features:
 * - Renders to document.body to avoid clipping by scroll containers
 * - Auto-positions to stay within viewport
 * - Fetches wiki metadata on-demand
 * - Supports mouse enter/leave for keeping popover open
 */
export function StructureInfoPopover({
  structure,
  category,
  anchorX,
  anchorY,
  onMouseEnter,
  onMouseLeave,
}: StructureInfoPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: anchorX, y: anchorY })

  // Fetch wiki metadata
  const { status: wikiStatus, metadata: wikiMetadata } = useWikiStructureMetadata(structure.name)

  // Update position when popover size is known
  const updatePosition = useCallback(() => {
    if (!popoverRef.current) return

    const rect = popoverRef.current.getBoundingClientRect()
    const newPos = calculatePosition(anchorX, anchorY, rect.width, rect.height)
    setPosition(newPos)
  }, [anchorX, anchorY])

  // Calculate position after initial render and when anchor changes
  useEffect(() => {
    // Use requestAnimationFrame to ensure the popover has rendered
    const frameId = requestAnimationFrame(updatePosition)
    return () => cancelAnimationFrame(frameId)
  }, [updatePosition])

  // Also recalculate when wiki data loads (may change height)
  useEffect(() => {
    if (wikiStatus === 'found' || wikiStatus === 'missing') {
      const frameId = requestAnimationFrame(updatePosition)
      return () => cancelAnimationFrame(frameId)
    }
  }, [wikiStatus, updatePosition])

  const popoverContent = (
    <div
      ref={popoverRef}
      className={styles.popover}
      style={{
        left: position.x,
        top: position.y,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <StructureInfoCard
        structure={structure}
        category={category}
        wikiStatus={wikiStatus}
        wikiMetadata={wikiMetadata}
      />
    </div>
  )

  return createPortal(popoverContent, document.body)
}
