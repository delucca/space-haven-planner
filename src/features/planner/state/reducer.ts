import type {
  Rotation,
  StructureDef,
  StructureTile,
  UserLayer,
  UserGroup,
  PlacedStructure,
  LayerId,
} from '@/data/types'
import { DEFAULT_PRESET, DEFAULT_ZOOM, LAYERS, ZOOM_MAX, ZOOM_MIN } from '@/data/presets'
import { findStructureById, findCategoryById } from '@/data/catalog'
import { getRotatedSize } from '@/data/types'
import { getBuiltinCatalog } from '@/data/jarCatalog'
import type { PlannerState, PlannerAction } from './types'

/**
 * Generate a unique ID for layers/groups
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Default user layer - single "Default" layer
 */
const DEFAULT_USER_LAYERS: UserLayer[] = [
  { id: 'layer-default', name: 'Default', isVisible: true, isLocked: false, order: 0 },
]

/**
 * Map system LayerId to default user layer ID
 * All system layers map to the single default layer
 */
const SYSTEM_LAYER_TO_USER_LAYER: Record<LayerId, string> = {
  Hull: 'layer-default',
  Rooms: 'layer-default',
  Systems: 'layer-default',
  Furniture: 'layer-default',
}

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
    tool: 'select',
    selection: null,
    previewRotation: 0,
    visibleLayers: new Set(LAYERS),
    expandedCategories: new Set(['hull']),
    // CAD-style layers and groups
    userLayers: DEFAULT_USER_LAYERS,
    userGroups: [],
    activeLayerId: 'layer-default', // Default layer is active
    activeGroupId: null,
    expandedLayerIds: new Set(DEFAULT_USER_LAYERS.map((l) => l.id)),
    expandedGroupIds: new Set(),
    structures: [],
    hullTiles: new Set(),
    hoveredTile: null,
    isDragging: false,
    selectedStructureIds: new Set(),
    catalog: getBuiltinCatalog(),
    catalogStatus: createInitialCatalogStatus(),
  }
}

/**
 * Get or create a group for a category within a layer
 */
function getOrCreateCategoryGroup(
  state: PlannerState,
  layerId: string,
  categoryId: string,
  categoryName: string
): { groups: readonly UserGroup[]; groupId: string } {
  // Check if group already exists for this category in this layer
  const existingGroup = state.userGroups.find(
    (g) => g.layerId === layerId && g.categoryId === categoryId
  )
  if (existingGroup) {
    return { groups: state.userGroups, groupId: existingGroup.id }
  }

  // Create new group
  const maxOrder = state.userGroups
    .filter((g) => g.layerId === layerId)
    .reduce((max, g) => Math.max(max, g.order), -1)

  const newGroup: UserGroup = {
    id: generateId(),
    layerId,
    name: categoryName,
    isVisible: true,
    isLocked: false,
    order: maxOrder + 1,
    categoryId,
  }

  return { groups: [...state.userGroups, newGroup], groupId: newGroup.id }
}

/**
 * Find the user layer for a given structure based on its system layer
 */
function findUserLayerForSystemLayer(state: PlannerState, systemLayer: LayerId): string {
  const defaultLayerId = SYSTEM_LAYER_TO_USER_LAYER[systemLayer]
  const layer = state.userLayers.find((l) => l.id === defaultLayerId)
  if (layer) return layer.id

  // Fallback to first layer if default not found
  return state.userLayers[0]?.id ?? 'layer-hull'
}

/**
 * Check if a structure is visible based on its layer and group visibility
 */
export function isStructureVisible(state: PlannerState, struct: PlacedStructure): boolean {
  // Check user layer visibility
  const layer = state.userLayers.find((l) => l.id === struct.orgLayerId)
  if (!layer || !layer.isVisible) return false

  // Check group visibility if structure is in a group
  if (struct.orgGroupId) {
    const group = state.userGroups.find((g) => g.id === struct.orgGroupId)
    if (group && !group.isVisible) return false
  }

  return true
}

/**
 * Check if a structure is interactive (can be selected/erased)
 * Must be visible AND not locked
 */
export function isStructureInteractive(state: PlannerState, struct: PlacedStructure): boolean {
  if (!isStructureVisible(state, struct)) return false

  // Check user layer lock
  const layer = state.userLayers.find((l) => l.id === struct.orgLayerId)
  if (layer?.isLocked) return false

  // Check group lock if structure is in a group
  if (struct.orgGroupId) {
    const group = state.userGroups.find((g) => g.id === struct.orgGroupId)
    if (group?.isLocked) return false
  }

  return true
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
    const existingTiles = getStructureTiles(found.structure, struct.x, struct.y, struct.rotation)

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
 * Find structure at given tile position (only interactive structures)
 */
function findStructureAt(state: PlannerState, x: number, y: number): string | null {
  const targetKey = hullTileKey(x, y)
  for (const struct of state.structures) {
    // Only find interactive structures (visible and not locked)
    if (!isStructureInteractive(state, struct)) continue

    const found = findStructureById(state.catalog, struct.structureId)
    if (!found) continue
    const tiles = getStructureTiles(found.structure, struct.x, struct.y, struct.rotation)
    if (tiles.all.has(targetKey)) return struct.id
  }
  return null
}

/**
 * Check if a structure intersects a selection rectangle (inclusive).
 * Uses tile-level hit testing (construction/blocked/access) when available.
 */
function structureIntersectsRect(
  state: PlannerState,
  struct: PlannerState['structures'][number],
  rect: { x1: number; y1: number; x2: number; y2: number }
): boolean {
  const found = findStructureById(state.catalog, struct.structureId)
  if (!found) return false
  const tiles = getStructureTiles(found.structure, struct.x, struct.y, struct.rotation)
  for (const key of tiles.all) {
    const { x, y } = parseHullTileKey(key)
    if (x >= rect.x1 && x <= rect.x2 && y >= rect.y1 && y <= rect.y2) {
      return true
    }
  }
  return false
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
        selectedStructureIds: new Set(),
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

    // CAD-style user layer actions
    case 'CREATE_LAYER': {
      const maxOrder = state.userLayers.reduce((max, l) => Math.max(max, l.order), -1)
      const newLayer: UserLayer = {
        id: generateId(),
        name: action.name,
        isVisible: true,
        isLocked: false,
        order: maxOrder + 1,
      }
      return {
        ...state,
        userLayers: [...state.userLayers, newLayer],
        activeLayerId: newLayer.id, // Auto-select the new layer
        activeGroupId: null,
      }
    }

    case 'RENAME_LAYER': {
      return {
        ...state,
        userLayers: state.userLayers.map((l) =>
          l.id === action.layerId ? { ...l, name: action.name } : l
        ),
      }
    }

    case 'TOGGLE_LAYER_VISIBLE': {
      return {
        ...state,
        userLayers: state.userLayers.map((l) =>
          l.id === action.layerId ? { ...l, isVisible: !l.isVisible } : l
        ),
      }
    }

    case 'TOGGLE_LAYER_LOCK': {
      return {
        ...state,
        userLayers: state.userLayers.map((l) =>
          l.id === action.layerId ? { ...l, isLocked: !l.isLocked } : l
        ),
      }
    }

    case 'DELETE_LAYER_AND_ITEMS': {
      // Don't allow deleting locked layers
      const layerToDelete = state.userLayers.find((l) => l.id === action.layerId)
      if (layerToDelete?.isLocked) {
        return state
      }

      // Delete all structures in this layer
      const remainingStructures = state.structures.filter((s) => s.orgLayerId !== action.layerId)
      // Delete all groups in this layer
      const remainingGroups = state.userGroups.filter((g) => g.layerId !== action.layerId)
      // Delete the layer itself
      const remainingLayers = state.userLayers.filter((l) => l.id !== action.layerId)

      // If deleting the active layer, select another one (there should always be one selected)
      let newActiveLayerId = state.activeLayerId
      let newActiveGroupId = state.activeGroupId
      if (state.activeLayerId === action.layerId) {
        // Select the first remaining layer, or null if none left
        newActiveLayerId = remainingLayers.length > 0 ? remainingLayers[0].id : null
        newActiveGroupId = null
      }

      return {
        ...state,
        userLayers: remainingLayers,
        userGroups: remainingGroups,
        structures: remainingStructures,
        activeLayerId: newActiveLayerId,
        activeGroupId: newActiveGroupId,
      }
    }

    case 'SET_ACTIVE_LAYER': {
      return {
        ...state,
        activeLayerId: action.layerId,
        activeGroupId: null, // Clear group selection when changing layer
      }
    }

    case 'TOGGLE_LAYER_EXPANDED': {
      const newExpanded = new Set(state.expandedLayerIds)
      if (newExpanded.has(action.layerId)) {
        newExpanded.delete(action.layerId)
      } else {
        newExpanded.add(action.layerId)
      }
      return {
        ...state,
        expandedLayerIds: newExpanded,
      }
    }

    case 'REORDER_LAYER': {
      return {
        ...state,
        userLayers: state.userLayers.map((l) =>
          l.id === action.layerId ? { ...l, order: action.newOrder } : l
        ),
      }
    }

    // CAD-style user group actions
    case 'CREATE_GROUP': {
      const maxOrder = state.userGroups
        .filter((g) => g.layerId === action.layerId)
        .reduce((max, g) => Math.max(max, g.order), -1)
      const newGroup: UserGroup = {
        id: generateId(),
        layerId: action.layerId,
        name: action.name,
        isVisible: true,
        isLocked: false,
        order: maxOrder + 1,
        categoryId: action.categoryId ?? null,
      }
      return {
        ...state,
        userGroups: [...state.userGroups, newGroup],
        activeLayerId: action.layerId, // Ensure parent layer is selected
        activeGroupId: newGroup.id, // Auto-select the new group
      }
    }

    case 'RENAME_GROUP': {
      return {
        ...state,
        userGroups: state.userGroups.map((g) =>
          g.id === action.groupId ? { ...g, name: action.name } : g
        ),
      }
    }

    case 'TOGGLE_GROUP_VISIBLE': {
      return {
        ...state,
        userGroups: state.userGroups.map((g) =>
          g.id === action.groupId ? { ...g, isVisible: !g.isVisible } : g
        ),
      }
    }

    case 'TOGGLE_GROUP_LOCK': {
      return {
        ...state,
        userGroups: state.userGroups.map((g) =>
          g.id === action.groupId ? { ...g, isLocked: !g.isLocked } : g
        ),
      }
    }

    case 'DELETE_GROUP_AND_ITEMS': {
      // Delete all structures in this group
      const remainingStructures = state.structures.filter((s) => s.orgGroupId !== action.groupId)
      // Delete the group itself
      const remainingGroups = state.userGroups.filter((g) => g.id !== action.groupId)

      // Clear active selection if it was on the deleted group
      let newActiveGroupId = state.activeGroupId
      if (state.activeGroupId === action.groupId) {
        newActiveGroupId = null
      }

      return {
        ...state,
        userGroups: remainingGroups,
        structures: remainingStructures,
        activeGroupId: newActiveGroupId,
      }
    }

    case 'SET_ACTIVE_GROUP': {
      // When setting active group, also set its parent layer as active
      const group = state.userGroups.find((g) => g.id === action.groupId)
      return {
        ...state,
        activeGroupId: action.groupId,
        activeLayerId: group?.layerId ?? state.activeLayerId,
      }
    }

    case 'TOGGLE_GROUP_EXPANDED': {
      const newExpanded = new Set(state.expandedGroupIds)
      if (newExpanded.has(action.groupId)) {
        newExpanded.delete(action.groupId)
      } else {
        newExpanded.add(action.groupId)
      }
      return {
        ...state,
        expandedGroupIds: newExpanded,
      }
    }

    case 'REORDER_GROUP': {
      return {
        ...state,
        userGroups: state.userGroups.map((g) =>
          g.id === action.groupId ? { ...g, order: action.newOrder } : g
        ),
      }
    }

    // Structure organization actions
    case 'MOVE_STRUCTURE_TO_GROUP': {
      return {
        ...state,
        structures: state.structures.map((s) =>
          s.id === action.structureId
            ? { ...s, orgLayerId: action.layerId, orgGroupId: action.groupId }
            : s
        ),
      }
    }

    case 'DELETE_STRUCTURE': {
      return {
        ...state,
        structures: state.structures.filter((s) => s.id !== action.structureId),
        // Also remove from grid selection if selected
        selectedStructureIds: state.selectedStructureIds.has(action.structureId)
          ? new Set([...state.selectedStructureIds].filter((id) => id !== action.structureId))
          : state.selectedStructureIds,
      }
    }

    case 'DELETE_STRUCTURES': {
      const idsToDelete = new Set(action.structureIds)
      return {
        ...state,
        structures: state.structures.filter((s) => !idsToDelete.has(s.id)),
        // Clear selection for deleted structures
        selectedStructureIds: new Set(
          [...state.selectedStructureIds].filter((id) => !idsToDelete.has(id))
        ),
      }
    }

    case 'LOAD_USER_LAYERS': {
      // Determine activeLayerId: use provided value, or fall back to first layer
      const newActiveLayerId =
        action.activeLayerId !== undefined
          ? action.activeLayerId
          : action.layers.length > 0
            ? action.layers[0].id
            : null

      return {
        ...state,
        userLayers: action.layers,
        userGroups: action.groups,
        activeLayerId: newActiveLayerId,
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

      // Determine org layer and group for the new structure
      let structureToPlace = action.structure
      let updatedGroups = state.userGroups

      // If structure doesn't have org IDs, assign them
      if (!structureToPlace.orgLayerId) {
        let orgLayerId: string
        let orgGroupId: string | null = null

        if (state.activeGroupId) {
          // Use active group
          const activeGroup = state.userGroups.find((g) => g.id === state.activeGroupId)
          if (activeGroup) {
            orgLayerId = activeGroup.layerId
            orgGroupId = activeGroup.id
          } else {
            orgLayerId = findUserLayerForSystemLayer(state, action.structure.layer)
          }
        } else if (state.activeLayerId) {
          // Use active layer, auto-create category group
          orgLayerId = state.activeLayerId
          const category = findCategoryById(state.catalog, action.structure.categoryId)
          if (category) {
            const result = getOrCreateCategoryGroup(
              { ...state, userGroups: updatedGroups },
              orgLayerId,
              category.id,
              category.name
            )
            updatedGroups = result.groups
            orgGroupId = result.groupId
          }
        } else {
          // Auto-assign based on system layer and category
          orgLayerId = findUserLayerForSystemLayer(state, action.structure.layer)
          const category = findCategoryById(state.catalog, action.structure.categoryId)
          if (category) {
            const result = getOrCreateCategoryGroup(
              { ...state, userGroups: updatedGroups },
              orgLayerId,
              category.id,
              category.name
            )
            updatedGroups = result.groups
            orgGroupId = result.groupId
          }
        }

        structureToPlace = {
          ...action.structure,
          orgLayerId,
          orgGroupId,
        }
      }

      return {
        ...state,
        structures: [...state.structures, structureToPlace],
        userGroups: updatedGroups,
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

    case 'ERASE_IN_RECT': {
      const minX = Math.min(action.x1, action.x2)
      const maxX = Math.max(action.x1, action.x2)
      const minY = Math.min(action.y1, action.y2)
      const maxY = Math.max(action.y1, action.y2)

      const x1 = Math.max(0, minX)
      const y1 = Math.max(0, minY)
      const x2 = Math.min(state.gridSize.width - 1, maxX)
      const y2 = Math.min(state.gridSize.height - 1, maxY)

      // If rect is completely out of bounds, nothing to erase
      if (x1 > x2 || y1 > y2) return state

      // Remove any interactive structures whose bounds intersects the rect
      let structuresChanged = false
      const remainingStructures: PlannerState['structures'][number][] = []
      for (const struct of state.structures) {
        // Only erase interactive structures (visible and not locked)
        const canErase = isStructureInteractive(state, struct)
        const intersects = canErase && structureIntersectsRect(state, struct, { x1, y1, x2, y2 })
        if (intersects) {
          structuresChanged = true
        } else {
          remainingStructures.push(struct)
        }
      }

      // Remove hull tiles inside the rect
      let newHullTiles: ReadonlySet<string> = state.hullTiles
      if (state.hullTiles.size > 0) {
        let mutable: Set<string> | null = null
        for (let x = x1; x <= x2; x++) {
          for (let y = y1; y <= y2; y++) {
            const key = hullTileKey(x, y)
            if (state.hullTiles.has(key)) {
              if (!mutable) mutable = new Set(state.hullTiles)
              mutable.delete(key)
            }
          }
        }
        if (mutable) newHullTiles = mutable
      }

      if (!structuresChanged && newHullTiles === state.hullTiles) return state

      return {
        ...state,
        structures: structuresChanged ? remainingStructures : state.structures,
        hullTiles: newHullTiles,
      }
    }

    case 'CLEAR_ALL_STRUCTURES':
      return {
        ...state,
        structures: [],
        hullTiles: new Set(),
        // Reset groups but keep layers
        userGroups: [],
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

    case 'PLACE_HULL_RECT': {
      const minX = Math.min(action.x1, action.x2)
      const maxX = Math.max(action.x1, action.x2)
      const minY = Math.min(action.y1, action.y2)
      const maxY = Math.max(action.y1, action.y2)

      const x1 = Math.max(0, minX)
      const y1 = Math.max(0, minY)
      const x2 = Math.min(state.gridSize.width - 1, maxX)
      const y2 = Math.min(state.gridSize.height - 1, maxY)

      // If rect is completely out of bounds, nothing to place
      if (x1 > x2 || y1 > y2) return state

      let mutable: Set<string> | null = null
      for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
          const key = hullTileKey(x, y)
          if (!state.hullTiles.has(key)) {
            if (!mutable) mutable = new Set(state.hullTiles)
            mutable.add(key)
          }
        }
      }

      if (!mutable) return state

      return {
        ...state,
        hullTiles: mutable,
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

    case 'ERASE_HULL_RECT': {
      const minX = Math.min(action.x1, action.x2)
      const maxX = Math.max(action.x1, action.x2)
      const minY = Math.min(action.y1, action.y2)
      const maxY = Math.max(action.y1, action.y2)

      const x1 = Math.max(0, minX)
      const y1 = Math.max(0, minY)
      const x2 = Math.min(state.gridSize.width - 1, maxX)
      const y2 = Math.min(state.gridSize.height - 1, maxY)

      if (x1 > x2 || y1 > y2) return state
      if (state.hullTiles.size === 0) return state

      let mutable: Set<string> | null = null
      for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
          const key = hullTileKey(x, y)
          if (state.hullTiles.has(key)) {
            if (!mutable) mutable = new Set(state.hullTiles)
            mutable.delete(key)
          }
        }
      }

      if (!mutable) return state

      return {
        ...state,
        hullTiles: mutable,
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

    // Grid selection actions (Select tool)
    case 'SET_SELECTED_STRUCTURES':
      return {
        ...state,
        selectedStructureIds: new Set(action.structureIds),
      }

    case 'CLEAR_SELECTED_STRUCTURES':
      return {
        ...state,
        selectedStructureIds: new Set(),
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
      // "New project" should clear the design, but keep the current "view" (canvas + zoom)
      // so users don't get a jarring zoom jump.
      return {
        ...createInitialState(),
        gridSize: state.gridSize,
        presetLabel: state.presetLabel,
        zoom: state.zoom,
        showGrid: state.showGrid,
        catalog: state.catalog, // Keep current catalog
        catalogStatus: state.catalogStatus,
        // Reset to default layer organization
        userLayers: DEFAULT_USER_LAYERS,
        userGroups: [],
        activeLayerId: 'layer-default',
        activeGroupId: null,
        expandedLayerIds: new Set(DEFAULT_USER_LAYERS.map((l) => l.id)),
        expandedGroupIds: new Set(),
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
