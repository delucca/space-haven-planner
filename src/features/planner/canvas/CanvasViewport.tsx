import { useRef, useEffect, useCallback, useState } from 'react'
import { usePlanner, canPlaceAt, isStructureInteractive } from '../state'
import { findStructureById, getRotatedSize } from '@/data'
import { ConfirmDialog } from '../components/ConfirmDialog'
import {
  createRenderContext,
  renderScene,
  renderSelectionOverlay,
  getTileFromMouse,
  type PreviewInfo,
  type SelectionOverlayRect,
} from './renderer'
import styles from './CanvasViewport.module.css'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

function normalizeRect(rect: SelectionOverlayRect): SelectionOverlayRect {
  return {
    x1: Math.min(rect.x1, rect.x2),
    y1: Math.min(rect.y1, rect.y2),
    x2: Math.max(rect.x1, rect.x2),
    y2: Math.max(rect.y1, rect.y2),
  }
}

function clampRect(
  rect: SelectionOverlayRect,
  gridSize: { width: number; height: number }
): SelectionOverlayRect {
  const r = normalizeRect(rect)
  return {
    x1: Math.max(0, r.x1),
    y1: Math.max(0, r.y1),
    x2: Math.min(gridSize.width - 1, r.x2),
    y2: Math.min(gridSize.height - 1, r.y2),
  }
}

function rectIntersectsBounds(
  rect: SelectionOverlayRect,
  bounds: { x: number; y: number; width: number; height: number }
): boolean {
  const r = normalizeRect(rect)
  const bx1 = bounds.x
  const by1 = bounds.y
  const bx2 = bounds.x + bounds.width - 1
  const by2 = bounds.y + bounds.height - 1
  return !(bx2 < r.x1 || bx1 > r.x2 || by2 < r.y1 || by1 > r.y2)
}

function rotateTilePosition(
  tile: { x: number; y: number },
  rotation: 0 | 90 | 180 | 270,
  layoutWidth: number,
  layoutHeight: number
): { x: number; y: number } {
  const { x, y } = tile

  switch (rotation) {
    case 0:
      return { x, y }
    case 90:
      return { x: layoutHeight - 1 - y, y: x }
    case 180:
      return { x: layoutWidth - 1 - x, y: layoutHeight - 1 - y }
    case 270:
      return { x: y, y: layoutWidth - 1 - x }
    default:
      return { x, y }
  }
}

function structureIntersectsRectByTiles(
  rect: SelectionOverlayRect,
  struct: { x: number; y: number; rotation: 0 | 90 | 180 | 270 },
  structureDef: {
    size: readonly [number, number]
    tileLayout?: { tiles: readonly { x: number; y: number }[]; width: number; height: number }
  }
): boolean {
  const r = normalizeRect(rect)

  // If we have a tile layout, use tile-level hit testing (includes access + blocked tiles)
  if (structureDef.tileLayout && structureDef.tileLayout.tiles.length > 0) {
    const { tiles, width: layoutWidth, height: layoutHeight } = structureDef.tileLayout

    // Quick bounds test using rotated layout dimensions
    const [bw, bh] = getRotatedSize([layoutWidth, layoutHeight] as const, struct.rotation)
    if (!rectIntersectsBounds(r, { x: struct.x, y: struct.y, width: bw, height: bh })) {
      return false
    }

    for (const tile of tiles) {
      const rotated = rotateTilePosition(tile, struct.rotation, layoutWidth, layoutHeight)
      const wx = struct.x + rotated.x
      const wy = struct.y + rotated.y
      if (wx >= r.x1 && wx <= r.x2 && wy >= r.y1 && wy <= r.y2) {
        return true
      }
    }
    return false
  }

  // Fallback: treat size as the full footprint
  const [w, h] = getRotatedSize(structureDef.size, struct.rotation)
  return rectIntersectsBounds(r, { x: struct.x, y: struct.y, width: w, height: h })
}

function getStructureSelectionBounds(
  struct: { x: number; y: number; rotation: 0 | 90 | 180 | 270 },
  structureDef: { size: readonly [number, number]; tileLayout?: { width: number; height: number } }
): { x: number; y: number; width: number; height: number } {
  if (structureDef.tileLayout) {
    const [w, h] = getRotatedSize(
      [structureDef.tileLayout.width, structureDef.tileLayout.height] as const,
      struct.rotation
    )
    return { x: struct.x, y: struct.y, width: w, height: h }
  }

  const [w, h] = getRotatedSize(structureDef.size, struct.rotation)
  return { x: struct.x, y: struct.y, width: w, height: h }
}

export function CanvasViewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { state, dispatch } = usePlanner()
  const [dragRect, setDragRect] = useState<SelectionOverlayRect | null>(null)
  const [pendingErase, setPendingErase] = useState<null | {
    rect: SelectionOverlayRect
    structureCount: number
    hullCount: number
  }>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const dragEndRef = useRef<{ x: number; y: number } | null>(null)
  const dragHullEraseRef = useRef<boolean>(false)

  const {
    gridSize,
    zoom,
    showGrid,
    tool,
    selection,
    previewRotation,
    structures,
    hullTiles,
    catalog,
    userLayers,
    userGroups,
    hoveredTile,
    isDragging,
  } = state

  // Create visibility state for rendering
  const visibilityState = { userLayers, userGroups }

  // Calculate preview info
  const getPreviewInfo = useCallback((): PreviewInfo | null => {
    if (!selection || !hoveredTile || tool !== 'place' || isDragging) return null

    const found = findStructureById(catalog, selection.structureId)
    if (!found) return null

    const [width, height] = getRotatedSize(found.structure.size, previewRotation)
    const isValid = canPlaceAt(
      state,
      selection.structureId,
      hoveredTile.x,
      hoveredTile.y,
      previewRotation
    )

    return {
      x: hoveredTile.x,
      y: hoveredTile.y,
      width,
      height,
      color: found.structure.color,
      isValid,
      rotation: previewRotation,
      tileLayout: found.structure.tileLayout,
    }
  }, [selection, hoveredTile, tool, catalog, previewRotation, state])

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rc = createRenderContext(canvas, gridSize, zoom)
    const preview = getPreviewInfo()

    // Get hull preview info for hull tool
    const hullPreview = tool === 'hull' && hoveredTile && !isDragging ? hoveredTile : null

    renderScene(rc, structures, hullTiles, catalog, visibilityState, showGrid, preview, hullPreview)

    if (isDragging && dragRect) {
      const clamped = clampRect(dragRect, gridSize)
      const normalized = normalizeRect(clamped)

      if (tool === 'hull') {
        renderSelectionOverlay(rc, {
          mode: dragHullEraseRef.current ? 'hull_erase' : 'hull_place',
          rect: normalized,
          hullTiles,
        })
      } else {
        // Only show interactive structures in selection overlay (for erase tool)
        const structureBounds: { x: number; y: number; width: number; height: number }[] = []
        for (const struct of structures) {
          // For erase tool, only show interactive structures
          if (tool === 'erase' && !isStructureInteractive(state, struct)) continue

          const found = findStructureById(catalog, struct.structureId)
          if (!found) continue
          if (structureIntersectsRectByTiles(normalized, struct, found.structure)) {
            structureBounds.push(getStructureSelectionBounds(struct, found.structure))
          }
        }

        renderSelectionOverlay(rc, {
          mode: tool === 'erase' ? 'erase' : 'select',
          rect: normalized,
          hullTiles,
          structureBounds,
        })
      }
    }
  }, [
    gridSize,
    zoom,
    showGrid,
    structures,
    hullTiles,
    catalog,
    visibilityState,
    getPreviewInfo,
    tool,
    hoveredTile,
    isDragging,
    dragRect,
  ])

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const tile = getTileFromMouse(canvas, e.clientX, e.clientY, zoom)
      dispatch({ type: 'SET_HOVERED_TILE', tile })

      // Handle dragging
      if (isDragging && dragStartRef.current) {
        const last = dragEndRef.current
        if (!last || last.x !== tile.x || last.y !== tile.y) {
          dragEndRef.current = { x: tile.x, y: tile.y }
          setDragRect({
            x1: dragStartRef.current.x,
            y1: dragStartRef.current.y,
            x2: tile.x,
            y2: tile.y,
          })
        }
      }
    },
    [zoom, dispatch, isDragging]
  )

  // Handle mouse down
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return // Only left click

      const canvas = canvasRef.current
      if (!canvas) return

      const tile = getTileFromMouse(canvas, e.clientX, e.clientY, zoom)
      dispatch({ type: 'SET_HOVERED_TILE', tile })
      dispatch({ type: 'SET_DRAGGING', isDragging: true })
      dragStartRef.current = { x: tile.x, y: tile.y }
      dragEndRef.current = { x: tile.x, y: tile.y }
      dragHullEraseRef.current = tool === 'hull' && e.shiftKey
      setDragRect({ x1: tile.x, y1: tile.y, x2: tile.x, y2: tile.y })
    },
    [zoom, dispatch, tool]
  )

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (!isDragging) return

    const start = dragStartRef.current
    const end = dragEndRef.current
    const wasHullErase = dragHullEraseRef.current

    // Reset drag state first (keeps UI snappy even if confirm blocks)
    dispatch({ type: 'SET_DRAGGING', isDragging: false })
    dragStartRef.current = null
    dragEndRef.current = null
    dragHullEraseRef.current = false
    setDragRect(null)

    if (!start || !end) return

    const rect = clampRect({ x1: start.x, y1: start.y, x2: end.x, y2: end.y }, gridSize)
    const normalized = normalizeRect(rect)

    // Tool-specific apply on mouse up
    if (tool === 'hull') {
      if (wasHullErase) {
        dispatch({
          type: 'ERASE_HULL_RECT',
          x1: normalized.x1,
          y1: normalized.y1,
          x2: normalized.x2,
          y2: normalized.y2,
        })
      } else {
        dispatch({
          type: 'PLACE_HULL_RECT',
          x1: normalized.x1,
          y1: normalized.y1,
          x2: normalized.x2,
          y2: normalized.y2,
        })
      }
      return
    }

    if (tool === 'place') {
      const isClick = start.x === end.x && start.y === end.y
      if (!isClick) return
      if (!selection) return

      const found = findStructureById(catalog, selection.structureId)
      if (!found) return

      // Don't check canPlaceAt here - let the reducer handle collision detection
      // The reducer will auto-assign orgLayerId and orgGroupId based on active selection or category
      dispatch({
        type: 'PLACE_STRUCTURE',
        structure: {
          id: generateId(),
          structureId: selection.structureId,
          categoryId: selection.categoryId,
          x: start.x,
          y: start.y,
          rotation: previewRotation,
          layer: found.category.defaultLayer,
          orgLayerId: '', // Will be auto-assigned by reducer
          orgGroupId: null,
        },
      })
      return
    }

    if (tool === 'erase') {
      // Determine what would be deleted for confirmation logic
      let hullCount = 0
      for (let x = normalized.x1; x <= normalized.x2; x++) {
        for (let y = normalized.y1; y <= normalized.y2; y++) {
          if (hullTiles.has(`${x},${y}`)) hullCount++
        }
      }

      // Only count interactive structures (visible and not locked)
      const structureIds = new Set<string>()
      for (const struct of structures) {
        // Skip non-interactive structures (hidden or locked)
        if (!isStructureInteractive(state, struct)) continue

        const found = findStructureById(catalog, struct.structureId)
        if (!found) continue
        if (structureIntersectsRectByTiles(normalized, struct, found.structure)) {
          structureIds.add(struct.id)
        }
      }

      const structureCount = structureIds.size
      if (structureCount === 0 && hullCount === 0) return

      // Hull-only deletions are allowed without confirmation
      if (structureCount === 0 && hullCount > 0) {
        dispatch({
          type: 'ERASE_HULL_RECT',
          x1: normalized.x1,
          y1: normalized.y1,
          x2: normalized.x2,
          y2: normalized.y2,
        })
        return
      }

      setPendingErase({ rect: normalized, structureCount, hullCount })
    }
  }, [
    dispatch,
    isDragging,
    tool,
    gridSize,
    selection,
    catalog,
    previewRotation,
    hullTiles,
    structures,
  ])

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    dispatch({ type: 'SET_HOVERED_TILE', tile: null })
    dispatch({ type: 'SET_DRAGGING', isDragging: false })
    dragStartRef.current = null
    dragEndRef.current = null
    dragHullEraseRef.current = false
    setDragRect(null)
  }, [dispatch])

  return (
    <div className={styles.container}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          cursor: tool === 'erase' ? 'crosshair' : tool === 'hull' ? 'cell' : 'pointer',
        }}
      />
      <ConfirmDialog
        isOpen={pendingErase !== null}
        title="🗑️ Confirm Delete"
        message={
          pendingErase
            ? `Delete ${pendingErase.structureCount} structure${pendingErase.structureCount === 1 ? '' : 's'}${
                pendingErase.hullCount > 0
                  ? ` and ${pendingErase.hullCount} hull tile${pendingErase.hullCount === 1 ? '' : 's'}`
                  : ''
              }? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setPendingErase(null)}
        onConfirm={() => {
          if (!pendingErase) return
          dispatch({
            type: 'ERASE_IN_RECT',
            x1: pendingErase.rect.x1,
            y1: pendingErase.rect.y1,
            x2: pendingErase.rect.x2,
            y2: pendingErase.rect.y2,
          })
          setPendingErase(null)
        }}
      />
    </div>
  )
}
