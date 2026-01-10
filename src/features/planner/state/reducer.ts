import type { Rotation, StructureDef, StructureTile } from '@/data/types'
import { DEFAULT_PRESET, DEFAULT_ZOOM, LAYERS, ZOOM_MAX, ZOOM_MIN } from '@/data/presets'
import { findStructureById } from '@/data/catalog'
import { getRotatedSize } from '@/data/types'
import { getBuiltinCatalog } from '@/data/jarCatalog'
import type { PlannerState, PlannerAction } from './types'

/**
 * Create initial catalog status
 */
function createInitialCatalogStatus(): PlannerState['catalogStatus'] {
  return {
    source: 'jar_builtin_snapshot',
    isParsing: false,
    lastUpdatedAt: null,
    lastError: null,
    jarFileName: null,
  }
}

/**
 * Create a hull tile key for Set storage
 */
export function hullTileKey(x: number, y: number): string {
  return `${x},${y}`
}

/**
 * Parse a hull tile key back to coordinates
 */
export function parseHullTileKey(key: string): { x: number; y: number } {
  const [x, y] = key.split(',').map(Number)
  return { x, y }
}

/**
 * Create initial planner state
 */
export function createInitialState(): PlannerState {
  return {
    gridSize: { width: DEFAULT_PRESET.width, height: DEFAULT_PRESET.height },
    presetLabel: DEFAULT_PRESET.label,
    zoom: DEFAULT_ZOOM,
    showGrid: true,
    tool: 'hull',
    selection: null,
    previewRotation: 0,
    visibleLayers: new Set(LAYERS),
    expandedCategories: new Set(['hull']),
    structures: [],
    hullTiles: new Set(),
    hoveredTile: null,
    isDragging: false,
    catalog: getBuiltinCatalog(),
    catalogStatus: createInitialCatalogStatus(),
  }
}

/**
 * Rotate by 90 degrees
 */
function rotateBy90(current: Rotation, direction: 'cw' | 'ccw'): Rotation {
  const rotations: Rotation[] = [0, 90, 180, 270]
  const idx = rotations.indexOf(current)
  if (direction === 'cw') {
    return rotations[(idx + 1) % 4]
  } else {
    return rotations[(idx + 3) % 4]
  }
}

/**
 * Rotate a tile position based on structure rotation
 * This mirrors the logic in renderer.ts for consistency
 */
function rotateTilePosition(
  tile: StructureTile,
  rotation: Rotation,
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

/**
 * Get all tiles for a structure at a position, categorized by type
 * Returns both blocking tiles (construction/blocked) and access tiles separately
 */
function getStructureTiles(
  structureDef: StructureDef,
  structX: number,
  structY: number,
  rotation: Rotation
): { blocking: Set<string>; access: Set<string>; all: Set<string> } {
  const blocking = new Set<string>()
  const access = new Set<string>()
  const all = new Set<string>()

  if (structureDef.tileLayout && structureDef.tileLayout.tiles.length > 0) {
    const { tiles, width: layoutWidth, height: layoutHeight } = structureDef.tileLayout

    for (const tile of tiles) {
      const rotatedPos = rotateTilePosition(tile, rotation, layoutWidth, layoutHeight)
      const worldX = structX + rotatedPos.x
      const worldY = structY + rotatedPos.y
      const key = `${worldX},${worldY}`

      all.add(key)
      if (tile.type === 'access') {
        access.add(key)
      } else {
        blocking.add(key)
      }
    }
  } else {
    // Fallback: entire bounding box is blocking
    const [width, height] = getRotatedSize(structureDef.size, rotation)
    for (let dx = 0; dx < width; dx++) {
      for (let dy = 0; dy < height; dy++) {
        const key = `${structX + dx},${structY + dy}`
        blocking.add(key)
        all.add(key)
      }
    }
  }

  return { blocking, access, all }
}

/**
 * Check if a structure at given position overlaps with existing structures
 * 
 * Collision rules:
 * - Blocking tiles (construction/blocked) CANNOT overlap with ANY tile of existing structures
 * - Access tiles CAN overlap with other access tiles only
 */
function hasCollision(
  state: PlannerState,
  structureDef: StructureDef,
  x: number,
  y: number,
  rotation: Rotation,
  excludeId?: string
): boolean {
  // Get tiles for the new structure
  const newTiles = getStructureTiles(structureDef, x, y, rotation)

  // If no tiles at all, no collision possible
  if (newTiles.all.size === 0) {
    return false
  }

  // Check against each existing structure
  for (const struct of state.structures) {
    if (excludeId && struct.id === excludeId) continue

    const found = findStructureById(state.catalog, struct.structureId)
    if (!found) continue

    // Get tiles for the existing structure
    const existingTiles = getStructureTiles(
      found.structure,
      struct.x,
      struct.y,
      struct.rotation
    )

    // Rule 1: New blocking tiles cannot overlap with ANY existing tile
    for (const tileKey of newTiles.blocking) {
      if (existingTiles.all.has(tileKey)) {
        return true
      }
    }

    // Rule 2: New access tiles cannot overlap with existing blocking tiles
    // (but CAN overlap with existing access tiles)
    for (const tileKey of newTiles.access) {
      if (existingTiles.blocking.has(tileKey)) {
        return true
      }
    }
  }

  return false
}

/**
 * Find structure at given tile position
 */
function findStructureAt(state: PlannerState, x: number, y: number): string | null {
  for (const struct of state.structures) {
    const found = findStructureById(state.catalog, struct.structureId)
    if (!found) continue

    const [sw, sh] = getRotatedSize(found.structure.size, struct.rotation)

    if (x >= struct.x && x < struct.x + sw && y >= struct.y && y < struct.y + sh) {
      return struct.id
    }
  }
  return null
}

/**
 * Planner state reducer
 */
export function plannerReducer(state: PlannerState, action: PlannerAction): PlannerState {
  switch (action.type) {
    // Grid actions
    case 'SET_PRESET':
      return {
        ...state,
        presetLabel: action.presetLabel,
        gridSize: action.gridSize,
      }

    case 'SET_ZOOM':
      return {
        ...state,
        zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, action.zoom)),
      }

    case 'TOGGLE_GRID':
      return {
        ...state,
        showGrid: !state.showGrid,
      }

    // Tool actions
    case 'SET_TOOL':
      return {
        ...state,
        tool: action.tool,
      }

    case 'SELECT_STRUCTURE':
      return {
        ...state,
        selection: {
          categoryId: action.categoryId,
          structureId: action.structureId,
        },
        tool: 'place',
        previewRotation: 0,
      }

    case 'CLEAR_SELECTION':
      return {
        ...state,
        selection: null,
      }

    case 'ROTATE_PREVIEW':
      return {
        ...state,
        previewRotation: rotateBy90(state.previewRotation, action.direction),
      }

    // Layer actions
    case 'TOGGLE_LAYER_VISIBILITY': {
      const newVisible = new Set(state.visibleLayers)
      if (newVisible.has(action.layer)) {
        newVisible.delete(action.layer)
      } else {
        newVisible.add(action.layer)
      }
      return {
        ...state,
        visibleLayers: newVisible,
      }
    }

    case 'TOGGLE_CATEGORY_EXPANDED': {
      const newExpanded = new Set(state.expandedCategories)
      if (newExpanded.has(action.categoryId)) {
        newExpanded.delete(action.categoryId)
      } else {
        newExpanded.add(action.categoryId)
      }
      return {
        ...state,
        expandedCategories: newExpanded,
      }
    }

    // Structure placement actions
    case 'PLACE_STRUCTURE': {
      const found = findStructureById(state.catalog, action.structure.structureId)
      if (!found) return state

      const [width, height] = getRotatedSize(found.structure.size, action.structure.rotation)

      // Bounds check
      if (
        action.structure.x < 0 ||
        action.structure.y < 0 ||
        action.structure.x + width > state.gridSize.width ||
        action.structure.y + height > state.gridSize.height
      ) {
        return state
      }

      // Collision check using tile-level detection
      if (
        hasCollision(
          state,
          found.structure,
          action.structure.x,
          action.structure.y,
          action.structure.rotation
        )
      ) {
        return state
      }

      return {
        ...state,
        structures: [...state.structures, action.structure],
      }
    }

    case 'ERASE_AT': {
      const structId = findStructureAt(state, action.x, action.y)
      const hullKey = `${action.x},${action.y}`
      const hasHullTile = state.hullTiles.has(hullKey)

      // Nothing to erase
      if (!structId && !hasHullTile) return state

      // Erase both structure and hull tile at this position
      let newHullTiles: ReadonlySet<string> = state.hullTiles
      if (hasHullTile) {
        const mutableHullTiles = new Set(state.hullTiles)
        mutableHullTiles.delete(hullKey)
        newHullTiles = mutableHullTiles
      }

      return {
        ...state,
        structures: structId ? state.structures.filter((s) => s.id !== structId) : state.structures,
        hullTiles: newHullTiles,
      }
    }

    case 'CLEAR_ALL_STRUCTURES':
      return {
        ...state,
        structures: [],
        hullTiles: new Set(),
      }

    case 'LOAD_STRUCTURES':
      return {
        ...state,
        structures: action.structures,
      }

    // Hull tile actions
    case 'PLACE_HULL_TILE': {
      // Bounds check
      if (
        action.x < 0 ||
        action.y < 0 ||
        action.x >= state.gridSize.width ||
        action.y >= state.gridSize.height
      ) {
        return state
      }

      const key = hullTileKey(action.x, action.y)
      if (state.hullTiles.has(key)) {
        return state // Already has hull tile
      }

      const newHullTiles = new Set(state.hullTiles)
      newHullTiles.add(key)
      return {
        ...state,
        hullTiles: newHullTiles,
      }
    }

    case 'ERASE_HULL_TILE': {
      const key = hullTileKey(action.x, action.y)
      if (!state.hullTiles.has(key)) {
        return state // No hull tile to erase
      }

      const newHullTiles = new Set(state.hullTiles)
      newHullTiles.delete(key)
      return {
        ...state,
        hullTiles: newHullTiles,
      }
    }

    case 'LOAD_HULL_TILES': {
      const newHullTiles = new Set<string>()
      for (const tile of action.tiles) {
        newHullTiles.add(hullTileKey(tile.x, tile.y))
      }
      return {
        ...state,
        hullTiles: newHullTiles,
      }
    }

    // Interaction actions
    case 'SET_HOVERED_TILE':
      return {
        ...state,
        hoveredTile: action.tile,
      }

    case 'SET_DRAGGING':
      return {
        ...state,
        isDragging: action.isDragging,
      }

    // Project actions
    case 'LOAD_PROJECT':
      return {
        ...state,
        ...action.state,
        catalog: state.catalog, // Keep current catalog
        catalogStatus: state.catalogStatus,
      }

    case 'NEW_PROJECT':
      return {
        ...createInitialState(),
        catalog: state.catalog, // Keep current catalog
        catalogStatus: state.catalogStatus,
      }

    // Catalog actions
    case 'SET_CATALOG':
      return {
        ...state,
        catalog: action.catalog,
        catalogStatus: {
          ...state.catalogStatus,
          source: action.source,
          isParsing: false,
          lastUpdatedAt: Date.now(),
          lastError: null,
        },
      }

    case 'SET_CATALOG_STATUS':
      return {
        ...state,
        catalogStatus: {
          ...state.catalogStatus,
          ...action.status,
        },
      }

    case 'REQUEST_JAR_PARSE':
      return {
        ...state,
        catalogStatus: {
          ...state.catalogStatus,
          isParsing: true,
          lastError: null,
        },
      }

    case 'RESET_TO_BUILTIN_CATALOG':
      return {
        ...state,
        catalog: getBuiltinCatalog(),
        catalogStatus: {
          source: 'jar_builtin_snapshot',
          isParsing: false,
          lastUpdatedAt: Date.now(),
          lastError: null,
          jarFileName: null,
        },
      }

    default:
      return state
  }
}

/**
 * Check if placement would be valid at given position
 */
export function canPlaceAt(
  state: PlannerState,
  structureId: string,
  x: number,
  y: number,
  rotation: Rotation
): boolean {
  const found = findStructureById(state.catalog, structureId)
  if (!found) return false

  const [width, height] = getRotatedSize(found.structure.size, rotation)

  // Bounds check
  if (x < 0 || y < 0 || x + width > state.gridSize.width || y + height > state.gridSize.height) {
    return false
  }

  // Collision check using tile-level detection
  return !hasCollision(state, found.structure, x, y, rotation)
}
