import { useRef, useEffect, useCallback } from 'react'
import { usePlanner, canPlaceAt } from '../state'
import { findStructureById, getRotatedSize } from '@/data'
import { createRenderContext, renderScene, getTileFromMouse, type PreviewInfo } from './renderer'
import styles from './CanvasViewport.module.css'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export function CanvasViewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { state, dispatch } = usePlanner()

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
    visibleLayers,
    hoveredTile,
    isDragging,
  } = state

  // Calculate preview info
  const getPreviewInfo = useCallback((): PreviewInfo | null => {
    if (!selection || !hoveredTile || tool !== 'place') return null

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
    const hullPreview = tool === 'hull' && hoveredTile ? hoveredTile : null

    renderScene(rc, structures, hullTiles, catalog, visibleLayers, showGrid, preview, hullPreview)
  }, [gridSize, zoom, showGrid, structures, hullTiles, catalog, visibleLayers, getPreviewInfo, tool, hoveredTile])

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const tile = getTileFromMouse(canvas, e.clientX, e.clientY, zoom)
      dispatch({ type: 'SET_HOVERED_TILE', tile })

      // Handle dragging
      if (isDragging) {
        if (tool === 'hull') {
          // Paint hull tiles while dragging (left click = place, shift+click handled in mousedown)
          dispatch({ type: 'PLACE_HULL_TILE', x: tile.x, y: tile.y })
        } else if (tool === 'place' && selection) {
          const found = findStructureById(catalog, selection.structureId)
          if (found) {
            // Don't check canPlaceAt here - let the reducer handle collision detection
            // The reducer has the most up-to-date state
            dispatch({
              type: 'PLACE_STRUCTURE',
              structure: {
                id: generateId(),
                structureId: selection.structureId,
                categoryId: selection.categoryId,
                x: tile.x,
                y: tile.y,
                rotation: previewRotation,
                layer: found.category.defaultLayer,
              },
            })
          }
        } else if (tool === 'erase') {
          dispatch({ type: 'ERASE_AT', x: tile.x, y: tile.y })
        }
      }
    },
    [zoom, dispatch, isDragging, tool, selection, catalog, state, previewRotation]
  )

  // Handle mouse down
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return // Only left click

      const canvas = canvasRef.current
      if (!canvas) return

      const tile = getTileFromMouse(canvas, e.clientX, e.clientY, zoom)
      dispatch({ type: 'SET_DRAGGING', isDragging: true })

      if (tool === 'hull') {
        // Right-click or shift+click erases hull tiles
        if (e.shiftKey) {
          dispatch({ type: 'ERASE_HULL_TILE', x: tile.x, y: tile.y })
        } else {
          dispatch({ type: 'PLACE_HULL_TILE', x: tile.x, y: tile.y })
        }
      } else if (tool === 'place' && selection) {
        const found = findStructureById(catalog, selection.structureId)
        if (found) {
          // Don't check canPlaceAt here - let the reducer handle collision detection
          // The reducer has the most up-to-date state
          dispatch({
            type: 'PLACE_STRUCTURE',
            structure: {
              id: generateId(),
              structureId: selection.structureId,
              categoryId: selection.categoryId,
              x: tile.x,
              y: tile.y,
              rotation: previewRotation,
              layer: found.category.defaultLayer,
            },
          })
        }
      } else if (tool === 'erase') {
        dispatch({ type: 'ERASE_AT', x: tile.x, y: tile.y })
      }
    },
    [zoom, dispatch, tool, selection, catalog, state, previewRotation]
  )

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    dispatch({ type: 'SET_DRAGGING', isDragging: false })
  }, [dispatch])

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    dispatch({ type: 'SET_HOVERED_TILE', tile: null })
    dispatch({ type: 'SET_DRAGGING', isDragging: false })
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
    </div>
  )
}
