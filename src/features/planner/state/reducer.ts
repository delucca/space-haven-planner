import type { Rotation } from '@/data/types'
import { DEFAULT_PRESET, DEFAULT_ZOOM, LAYERS, ZOOM_MAX, ZOOM_MIN } from '@/data/presets'
import { getCatalog, findStructureById } from '@/data/catalog'
import { getRotatedSize } from '@/data/types'
import type { PlannerState, PlannerAction } from './types'

/**
 * Create initial catalog status
 */
function createInitialCatalogStatus(): PlannerState['catalogStatus'] {
  return {
    source: 'built_in',
    isRefreshing: false,
    lastUpdatedAt: null,
    lastError: null,
  }
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
    tool: 'place',
    selection: null,
    previewRotation: 0,
    visibleLayers: new Set(LAYERS),
    expandedCategories: new Set(['hull']),
    structures: [],
    hoveredTile: null,
    isDragging: false,
    catalog: getCatalog(),
    catalogStatus: createInitialCatalogStatus(),
    catalogRefreshRequestId: 0,
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
 * Check if a structure at given position overlaps with existing structures
 */
function hasCollision(
  state: PlannerState,
  x: number,
  y: number,
  width: number,
  height: number,
  excludeId?: string
): boolean {
  for (const struct of state.structures) {
    if (excludeId && struct.id === excludeId) continue

    const found = findStructureById(state.catalog, struct.structureId)
    if (!found) continue

    const [sw, sh] = getRotatedSize(found.structure.size, struct.rotation)

    // Check overlap
    const noOverlap =
      x + width <= struct.x || x >= struct.x + sw || y + height <= struct.y || y >= struct.y + sh

    if (!noOverlap) {
      return true
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

      // Collision check
      if (hasCollision(state, action.structure.x, action.structure.y, width, height)) {
        return state
      }

      return {
        ...state,
        structures: [...state.structures, action.structure],
      }
    }

    case 'ERASE_AT': {
      const structId = findStructureAt(state, action.x, action.y)
      if (!structId) return state

      return {
        ...state,
        structures: state.structures.filter((s) => s.id !== structId),
      }
    }

    case 'CLEAR_ALL_STRUCTURES':
      return {
        ...state,
        structures: [],
      }

    case 'LOAD_STRUCTURES':
      return {
        ...state,
        structures: action.structures,
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
        catalogRefreshRequestId: state.catalogRefreshRequestId,
      }

    case 'NEW_PROJECT':
      return {
        ...createInitialState(),
        catalog: state.catalog, // Keep current catalog
        catalogStatus: state.catalogStatus,
        catalogRefreshRequestId: state.catalogRefreshRequestId,
      }

    // Catalog refresh actions
    case 'REQUEST_CATALOG_REFRESH':
      return {
        ...state,
        catalogRefreshRequestId: state.catalogRefreshRequestId + 1,
        catalogStatus: {
          ...state.catalogStatus,
          isRefreshing: true,
          lastError: null,
        },
      }

    case 'SET_CATALOG':
      return {
        ...state,
        catalog: action.catalog,
        catalogStatus: {
          ...state.catalogStatus,
          source: action.source,
          isRefreshing: false,
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

  // Collision check
  return !hasCollision(state, x, y, width, height)
}
