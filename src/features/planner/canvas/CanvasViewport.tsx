import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { usePlanner, isStructureInteractive, canPlaceAt } from '../state'
import {
  findStructureById,
  getRotatedSize,
  type StructureCatalog,
  type PlacedStructure,
  type StructureDef,
  type StructureCategory,
} from '@/data'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { StructureInfoPopover } from '../components/StructureInfoPopover'
import {
  createRenderContext,
  renderScene,
  renderSelectionOverlay,
  getTileFromMouse,
  type PreviewInfo,
  type SelectionOverlayRect,
} from './renderer'
import styles from './CanvasViewport.module.css'

/** Hover delay before showing popover (ms) */
const HOVER_DELAY_MS = 500

/** Delay before closing popover when mouse leaves (ms) - allows moving to popover */
const CLOSE_DELAY_MS = 150

/** Check if event target is an input element */
function isInputElement(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

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

/** Check if moving selected structures by delta would be valid (bounds + collision) */
function isMoveValid(
  selectedIds: ReadonlySet<string>,
  structures: readonly PlacedStructure[],
  catalog: StructureCatalog,
  gridSize: { width: number; height: number },
  deltaX: number,
  deltaY: number
): boolean {
  // Get IDs of non-selected structures for collision checking
  const nonSelectedStructures = structures.filter((s) => !selectedIds.has(s.id))

  for (const struct of structures) {
    if (!selectedIds.has(struct.id)) continue

    const found = findStructureById(catalog, struct.structureId)
    if (!found) continue

    const newX = struct.x + deltaX
    const newY = struct.y + deltaY
    const [width, height] = getRotatedSize(found.structure.size, struct.rotation)

    // Bounds check
    if (newX < 0 || newY < 0 || newX + width > gridSize.width || newY + height > gridSize.height) {
      return false
    }

    // Simple bounding box collision check against non-selected structures
    // (Full tile-level collision is done in reducer, this is just for preview feedback)
    for (const other of nonSelectedStructures) {
      const otherFound = findStructureById(catalog, other.structureId)
      if (!otherFound) continue
      const [otherW, otherH] = getRotatedSize(otherFound.structure.size, other.rotation)

      // Check bounding box overlap
      if (
        newX < other.x + otherW &&
        newX + width > other.x &&
        newY < other.y + otherH &&
        newY + height > other.y
      ) {
        return false
      }
    }
  }

  return true
}

/** Find the structure at a tile position (returns structure id or null) */
function findStructureAtTile(
  tileX: number,
  tileY: number,
  structures: readonly {
    id: string
    x: number
    y: number
    rotation: 0 | 90 | 180 | 270
    structureId: string
  }[],
  catalog: Parameters<typeof findStructureById>[0]
): string | null {
  for (const struct of structures) {
    const found = findStructureById(catalog, struct.structureId)
    if (!found) continue
    const bounds = getStructureSelectionBounds(struct, found.structure)
    if (
      tileX >= bounds.x &&
      tileX < bounds.x + bounds.width &&
      tileY >= bounds.y &&
      tileY < bounds.y + bounds.height
    ) {
      return struct.id
    }
  }
  return null
}

/** Find the structure at a tile position and return full info */
function findStructureInfoAtTile(
  tileX: number,
  tileY: number,
  structures: readonly PlacedStructure[],
  catalog: Parameters<typeof findStructureById>[0]
): { structure: StructureDef; category: StructureCategory } | null {
  for (const struct of structures) {
    const found = findStructureById(catalog, struct.structureId)
    if (!found) continue
    const bounds = getStructureSelectionBounds(struct, found.structure)
    if (
      tileX >= bounds.x &&
      tileX < bounds.x + bounds.width &&
      tileY >= bounds.y &&
      tileY < bounds.y + bounds.height
    ) {
      return { structure: found.structure, category: found.category }
    }
  }
  return null
}

/** State for hovered structure popover on canvas */
interface CanvasHoveredState {
  structure: StructureDef
  category: StructureCategory
  anchorX: number
  anchorY: number
}

export function CanvasViewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { state, dispatch } = usePlanner()
  const [dragRect, setDragRect] = useState<SelectionOverlayRect | null>(null)
  const [pendingErase, setPendingErase] = useState<null | {
    rect: SelectionOverlayRect
    structureCount: number
    hullCount: number
  }>(null)
  const [pendingDeleteSelection, setPendingDeleteSelection] = useState(false)
  const [isSpaceHeld, setIsSpaceHeld] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [isMovingSelection, setIsMovingSelection] = useState(false)
  const [moveDelta, setMoveDelta] = useState<{ x: number; y: number } | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const dragEndRef = useRef<{ x: number; y: number } | null>(null)
  const dragHullEraseRef = useRef<boolean>(false)
  // For Space+drag panning
  const panStartRef = useRef<{
    scrollLeft: number
    scrollTop: number
    clientX: number
    clientY: number
  } | null>(null)

  // Hover popover state for canvas structures
  const [canvasHoveredItem, setCanvasHoveredItem] = useState<CanvasHoveredState | null>(null)
  const canvasHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const canvasCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const canvasMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const lastHoveredTileRef = useRef<{ x: number; y: number } | null>(null)

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
    selectedStructureIds,
  } = state

  // Create visibility state for rendering
  const visibilityState = useMemo(() => ({ userLayers, userGroups }), [userLayers, userGroups])

  // Clear canvas hover timer
  const clearCanvasHoverTimer = useCallback(() => {
    if (canvasHoverTimerRef.current) {
      clearTimeout(canvasHoverTimerRef.current)
      canvasHoverTimerRef.current = null
    }
  }, [])

  // Clear canvas close timer
  const clearCanvasCloseTimer = useCallback(() => {
    if (canvasCloseTimerRef.current) {
      clearTimeout(canvasCloseTimerRef.current)
      canvasCloseTimerRef.current = null
    }
  }, [])

  // Schedule canvas popover close with delay
  const scheduleCanvasClose = useCallback(() => {
    clearCanvasCloseTimer()
    canvasCloseTimerRef.current = setTimeout(() => {
      setCanvasHoveredItem(null)
    }, CLOSE_DELAY_MS)
  }, [clearCanvasCloseTimer])

  // Start hover timer for canvas popover
  const startCanvasHoverTimer = useCallback(() => {
    // Cancel any pending close
    clearCanvasCloseTimer()
    clearCanvasHoverTimer()

    canvasHoverTimerRef.current = setTimeout(() => {
      const pos = canvasMousePosRef.current
      const tile = lastHoveredTileRef.current
      if (!tile) return

      const info = findStructureInfoAtTile(tile.x, tile.y, structures, catalog)
      if (info) {
        setCanvasHoveredItem({
          structure: info.structure,
          category: info.category,
          anchorX: pos.x,
          anchorY: pos.y,
        })
      }
    }, HOVER_DELAY_MS)
  }, [clearCanvasCloseTimer, clearCanvasHoverTimer, structures, catalog])

  // Close canvas popover when dragging/panning starts
  // We handle this in the event handlers (handleMouseDown) instead of an effect
  // to avoid the lint warning about setState in effects

  // Track Space key for panning and Delete/Backspace for deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputElement(e.target)) return

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        setIsSpaceHeld(true)
      }

      // Delete/Backspace to delete selected structures
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedStructureIds.size > 0) {
        e.preventDefault()
        setPendingDeleteSelection(true)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        setIsSpaceHeld(false)
        setIsPanning(false)
        panStartRef.current = null
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [selectedStructureIds.size])

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
  }, [selection, hoveredTile, tool, catalog, previewRotation, state, isDragging])

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rc = createRenderContext(canvas, gridSize, zoom)
    const preview = getPreviewInfo()

    // Get hull preview info for hull tool
    const hullPreview = tool === 'hull' && hoveredTile && !isDragging ? hoveredTile : null

    renderScene(rc, structures, hullTiles, catalog, visibilityState, showGrid, preview, hullPreview)

    if (isDragging && dragRect && !isPanning) {
      const clamped = clampRect(dragRect, gridSize)
      const normalized = normalizeRect(clamped)

      if (tool === 'hull') {
        renderSelectionOverlay(rc, {
          mode: dragHullEraseRef.current ? 'hull_erase' : 'hull_place',
          rect: normalized,
          hullTiles,
        })
      } else {
        // Only show interactive structures in selection overlay (for erase/select tools)
        const structureBounds: { x: number; y: number; width: number; height: number }[] = []
        for (const struct of structures) {
          // For erase/select tool, only show interactive structures
          if ((tool === 'erase' || tool === 'select') && !isStructureInteractive(state, struct))
            continue

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

    // Render selection highlight for already-selected structures (Select tool)
    if (selectedStructureIds.size > 0) {
      const { ctx, zoom: z } = rc
      const deltaX = isMovingSelection && moveDelta ? moveDelta.x : 0
      const deltaY = isMovingSelection && moveDelta ? moveDelta.y : 0

      // Check if the move is valid (for visual feedback)
      const moveIsValid =
        !isMovingSelection ||
        !moveDelta ||
        (moveDelta.x === 0 && moveDelta.y === 0) ||
        isMoveValid(selectedStructureIds, structures, catalog, gridSize, deltaX, deltaY)

      const selectedBounds: { x: number; y: number; width: number; height: number }[] = []
      for (const struct of structures) {
        if (!selectedStructureIds.has(struct.id)) continue
        const found = findStructureById(catalog, struct.structureId)
        if (!found) continue
        const bounds = getStructureSelectionBounds(struct, found.structure)
        // Apply move delta for preview
        selectedBounds.push({
          ...bounds,
          x: bounds.x + deltaX,
          y: bounds.y + deltaY,
        })
      }

      if (selectedBounds.length > 0) {
        // If moving, draw semi-transparent preview of structures at new position
        if (isMovingSelection && moveDelta && (moveDelta.x !== 0 || moveDelta.y !== 0)) {
          ctx.globalAlpha = 0.5
          for (const struct of structures) {
            if (!selectedStructureIds.has(struct.id)) continue
            const found = findStructureById(catalog, struct.structureId)
            if (!found) continue
            const bounds = getStructureSelectionBounds(struct, found.structure)
            const px = (bounds.x + deltaX) * z
            const py = (bounds.y + deltaY) * z
            const pw = bounds.width * z
            const ph = bounds.height * z
            // Red tint if move is invalid, otherwise use structure color
            ctx.fillStyle = moveIsValid ? found.structure.color : '#ff4444'
            ctx.fillRect(px, py, pw, ph)
          }
          ctx.globalAlpha = 1.0
        }

        // Draw selection highlight around selected structures (at preview position)
        // Red border if move is invalid
        ctx.strokeStyle = moveIsValid ? '#58a6ff' : '#ff4444'
        ctx.lineWidth = 2
        ctx.setLineDash([4, 2])
        for (const bounds of selectedBounds) {
          const px = bounds.x * z
          const py = bounds.y * z
          const pw = bounds.width * z
          const ph = bounds.height * z
          ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2)
        }
        ctx.setLineDash([])
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
    selectedStructureIds,
    isPanning,
    isMovingSelection,
    moveDelta,
    state,
  ])

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      // Always track mouse position for popover anchor
      canvasMousePosRef.current = { x: e.clientX, y: e.clientY }

      // Handle Space+drag panning
      if (isPanning && panStartRef.current) {
        const scrollContainer = containerRef.current?.parentElement
        if (scrollContainer) {
          const dx = e.clientX - panStartRef.current.clientX
          const dy = e.clientY - panStartRef.current.clientY
          scrollContainer.scrollLeft = panStartRef.current.scrollLeft - dx
          scrollContainer.scrollTop = panStartRef.current.scrollTop - dy
        }
        return
      }

      const tile = getTileFromMouse(canvas, e.clientX, e.clientY, zoom)
      dispatch({ type: 'SET_HOVERED_TILE', tile })

      // Track tile changes for hover popover (restart timer when tile changes)
      const lastTile = lastHoveredTileRef.current
      if (!lastTile || lastTile.x !== tile.x || lastTile.y !== tile.y) {
        lastHoveredTileRef.current = { x: tile.x, y: tile.y }

        // Close popover and restart timer when tile changes
        setCanvasHoveredItem(null)
        if (!isDragging && !isPanning && !isMovingSelection) {
          startCanvasHoverTimer()
        }
      }

      // Handle move selection drag
      if (isMovingSelection && dragStartRef.current) {
        const deltaX = tile.x - dragStartRef.current.x
        const deltaY = tile.y - dragStartRef.current.y
        setMoveDelta({ x: deltaX, y: deltaY })
        dragEndRef.current = { x: tile.x, y: tile.y }
        return
      }

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
    [zoom, dispatch, isDragging, isPanning, isMovingSelection, startCanvasHoverTimer]
  )

  // Handle mouse down
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return // Only left click

      const canvas = canvasRef.current
      if (!canvas) return

      // Clear canvas hover popover when starting any interaction
      clearCanvasHoverTimer()
      clearCanvasCloseTimer()
      setCanvasHoveredItem(null)

      // Space+drag = panning (works in all tools)
      if (isSpaceHeld) {
        const scrollContainer = containerRef.current?.parentElement
        if (scrollContainer) {
          setIsPanning(true)
          panStartRef.current = {
            scrollLeft: scrollContainer.scrollLeft,
            scrollTop: scrollContainer.scrollTop,
            clientX: e.clientX,
            clientY: e.clientY,
          }
        }
        return
      }

      const tile = getTileFromMouse(canvas, e.clientX, e.clientY, zoom)
      dispatch({ type: 'SET_HOVERED_TILE', tile })

      // In Select tool, check if clicking on any structure to start move
      if (tool === 'select') {
        const clickedStructureId = findStructureAtTile(tile.x, tile.y, structures, catalog)
        if (clickedStructureId) {
          const isAlreadySelected = selectedStructureIds.has(clickedStructureId)

          // Shift+click: add/toggle structure in selection
          if (e.shiftKey) {
            if (isAlreadySelected) {
              // Remove from selection
              const newSelection = [...selectedStructureIds].filter(
                (id) => id !== clickedStructureId
              )
              dispatch({ type: 'SET_SELECTED_STRUCTURES', structureIds: newSelection })
            } else {
              // Add to selection
              dispatch({
                type: 'SET_SELECTED_STRUCTURES',
                structureIds: [...selectedStructureIds, clickedStructureId],
              })
            }
            // Don't start moving on shift+click, just update selection
            return
          }

          // Regular click: select only this structure (if not already selected)
          if (!isAlreadySelected) {
            dispatch({ type: 'SET_SELECTED_STRUCTURES', structureIds: [clickedStructureId] })
          }
          // Start moving
          setIsMovingSelection(true)
          setMoveDelta({ x: 0, y: 0 })
          dragStartRef.current = { x: tile.x, y: tile.y }
          dragEndRef.current = { x: tile.x, y: tile.y }
          dispatch({ type: 'SET_DRAGGING', isDragging: true })
          return
        }
      }

      dispatch({ type: 'SET_DRAGGING', isDragging: true })
      dragStartRef.current = { x: tile.x, y: tile.y }
      dragEndRef.current = { x: tile.x, y: tile.y }
      dragHullEraseRef.current = tool === 'hull' && e.shiftKey
      setDragRect({ x1: tile.x, y1: tile.y, x2: tile.x, y2: tile.y })
    },
    [
      zoom,
      dispatch,
      tool,
      isSpaceHeld,
      selectedStructureIds,
      structures,
      catalog,
      clearCanvasHoverTimer,
    ]
  )

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    // Handle end of panning
    if (isPanning) {
      setIsPanning(false)
      panStartRef.current = null
      return
    }

    // Handle end of move selection
    if (isMovingSelection) {
      if (moveDelta && (moveDelta.x !== 0 || moveDelta.y !== 0)) {
        dispatch({ type: 'MOVE_SELECTED_STRUCTURES', deltaX: moveDelta.x, deltaY: moveDelta.y })
      }
      setIsMovingSelection(false)
      setMoveDelta(null)
      dispatch({ type: 'SET_DRAGGING', isDragging: false })
      dragStartRef.current = null
      dragEndRef.current = null
      return
    }

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

    if (tool === 'select') {
      // Box-select interactive structures in the selection rect
      const selectedIds: string[] = []
      for (const struct of structures) {
        if (!isStructureInteractive(state, struct)) continue
        const found = findStructureById(catalog, struct.structureId)
        if (!found) continue
        if (structureIntersectsRectByTiles(normalized, struct, found.structure)) {
          selectedIds.push(struct.id)
        }
      }
      dispatch({ type: 'SET_SELECTED_STRUCTURES', structureIds: selectedIds })
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
    isPanning,
    isMovingSelection,
    moveDelta,
    tool,
    gridSize,
    selection,
    catalog,
    previewRotation,
    hullTiles,
    structures,
    state,
  ])

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    dispatch({ type: 'SET_HOVERED_TILE', tile: null })
    dispatch({ type: 'SET_DRAGGING', isDragging: false })
    dragStartRef.current = null
    dragEndRef.current = null
    dragHullEraseRef.current = false
    setIsPanning(false)
    setIsMovingSelection(false)
    setMoveDelta(null)
    panStartRef.current = null
    setDragRect(null)

    // Clear canvas hover popover with delay
    clearCanvasHoverTimer()
    lastHoveredTileRef.current = null
    scheduleCanvasClose()
  }, [dispatch, clearCanvasHoverTimer, scheduleCanvasClose])

  // Check if hovering over any structure (for cursor) - in Select mode, any structure can be moved
  const isHoveringStructure = useMemo(() => {
    if (tool !== 'select' || !hoveredTile) return false
    return findStructureAtTile(hoveredTile.x, hoveredTile.y, structures, catalog) !== null
  }, [tool, hoveredTile, structures, catalog])

  // Handle canvas popover mouse enter
  const handleCanvasPopoverMouseEnter = useCallback(() => {
    // Cancel any pending close when mouse enters popover
    clearCanvasCloseTimer()
  }, [clearCanvasCloseTimer])

  // Handle canvas popover mouse leave
  const handleCanvasPopoverMouseLeave = useCallback(() => {
    // Schedule close with delay
    scheduleCanvasClose()
  }, [scheduleCanvasClose])

  // Determine cursor based on tool and state
  const getCursor = () => {
    // Space held = pan mode (works in all tools)
    if (isSpaceHeld) return isPanning ? 'grabbing' : 'grab'
    if (isMovingSelection) return 'move'
    if (tool === 'erase') return 'crosshair'
    if (tool === 'hull') return 'cell'
    if (tool === 'select') return isHoveringStructure ? 'move' : 'default'
    return 'pointer'
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          cursor: getCursor(),
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
              }? You can undo with Ctrl/Cmd+Z.`
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
      <ConfirmDialog
        isOpen={pendingDeleteSelection}
        title="🗑️ Delete Selected"
        message={`Delete ${selectedStructureIds.size} selected structure${selectedStructureIds.size === 1 ? '' : 's'}? You can undo with Ctrl/Cmd+Z.`}
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setPendingDeleteSelection(false)}
        onConfirm={() => {
          dispatch({
            type: 'DELETE_STRUCTURES',
            structureIds: [...selectedStructureIds],
          })
          setPendingDeleteSelection(false)
        }}
      />

      {/* Canvas hover popover */}
      {canvasHoveredItem && (
        <StructureInfoPopover
          structure={canvasHoveredItem.structure}
          category={canvasHoveredItem.category}
          anchorX={canvasHoveredItem.anchorX}
          anchorY={canvasHoveredItem.anchorY}
          onMouseEnter={handleCanvasPopoverMouseEnter}
          onMouseLeave={handleCanvasPopoverMouseLeave}
        />
      )}
    </div>
  )
}
