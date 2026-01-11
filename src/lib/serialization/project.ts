import type {
  GridSize,
  HullTile,
  PlacedStructure,
  Rotation,
  UserLayer,
  UserGroup,
  LayerId,
} from '@/data/types'

/** Current project file format version */
export const PROJECT_VERSION = 4

/**
 * Project file format for JSON save/load
 */
export interface ProjectFile {
  version: number
  gridSize: GridSize
  preset: string
  structures: SerializedStructure[]
  hullTiles?: SerializedHullTile[] // Optional for backwards compatibility
  // v4+ fields for CAD-style layers
  userLayers?: SerializedUserLayer[]
  userGroups?: SerializedUserGroup[]
  activeLayerId?: string | null // v4+: currently selected layer
}

/**
 * Serialized user layer format
 */
export interface SerializedUserLayer {
  id: string
  name: string
  isVisible: boolean
  isLocked: boolean
  order: number
}

/**
 * Serialized user group format
 */
export interface SerializedUserGroup {
  id: string
  layerId: string
  name: string
  isVisible: boolean
  isLocked: boolean
  order: number
  categoryId?: string | null
}

/**
 * Serialized hull tile format
 */
export interface SerializedHullTile {
  x: number
  y: number
}

/**
 * Serialized structure format (matches PlacedStructure but with explicit types for JSON)
 */
export interface SerializedStructure {
  id: string
  structureId: string
  categoryId: string
  x: number
  y: number
  rotation: Rotation
  layer: string
  // v4+ fields for CAD-style organization
  orgLayerId?: string
  orgGroupId?: string | null
}

/**
 * Serialize placed structures for JSON export
 */
export function serializeStructures(structures: readonly PlacedStructure[]): SerializedStructure[] {
  return structures.map((s) => ({
    id: s.id,
    structureId: s.structureId,
    categoryId: s.categoryId,
    x: s.x,
    y: s.y,
    rotation: s.rotation,
    layer: s.layer,
    orgLayerId: s.orgLayerId,
    orgGroupId: s.orgGroupId,
  }))
}

/**
 * Map system LayerId to default user layer ID (for migration)
 */
const SYSTEM_LAYER_TO_USER_LAYER: Record<LayerId, string> = {
  Hull: 'layer-hull',
  Rooms: 'layer-rooms',
  Systems: 'layer-systems',
  Furniture: 'layer-furniture',
}

/**
 * Default user layers (for migration from v3 and earlier)
 */
const DEFAULT_USER_LAYERS: UserLayer[] = [
  { id: 'layer-hull', name: 'Hull', isVisible: true, isLocked: false, order: 0 },
  { id: 'layer-rooms', name: 'Rooms', isVisible: true, isLocked: false, order: 1 },
  { id: 'layer-systems', name: 'Systems', isVisible: true, isLocked: false, order: 2 },
  { id: 'layer-furniture', name: 'Furniture', isVisible: true, isLocked: false, order: 3 },
]

/**
 * Deserialize structures from JSON import
 * For v3 and earlier, structures won't have orgLayerId/orgGroupId, so we migrate them
 */
export function deserializeStructures(data: SerializedStructure[]): PlacedStructure[] {
  return data.map((s) => {
    const layer = s.layer as LayerId
    // For v3 and earlier structures, assign default orgLayerId based on system layer
    const orgLayerId = s.orgLayerId || SYSTEM_LAYER_TO_USER_LAYER[layer] || 'layer-hull'
    const orgGroupId = s.orgGroupId ?? null

    return {
      id: s.id,
      structureId: s.structureId,
      categoryId: s.categoryId,
      x: s.x,
      y: s.y,
      rotation: (s.rotation ?? 0) as Rotation,
      layer,
      orgLayerId,
      orgGroupId,
    }
  })
}

/**
 * Serialize user layers for JSON export
 */
export function serializeUserLayers(layers: readonly UserLayer[]): SerializedUserLayer[] {
  return layers.map((l) => ({
    id: l.id,
    name: l.name,
    isVisible: l.isVisible,
    isLocked: l.isLocked,
    order: l.order,
  }))
}

/**
 * Deserialize user layers from JSON import
 */
export function deserializeUserLayers(data: SerializedUserLayer[] | undefined): UserLayer[] {
  if (!data || data.length === 0) {
    // Return default layers for v3 and earlier projects
    return DEFAULT_USER_LAYERS
  }
  return data.map((l) => ({
    id: l.id,
    name: l.name,
    isVisible: l.isVisible ?? true,
    isLocked: l.isLocked ?? false,
    order: l.order ?? 0,
  }))
}

/**
 * Serialize user groups for JSON export
 */
export function serializeUserGroups(groups: readonly UserGroup[]): SerializedUserGroup[] {
  return groups.map((g) => ({
    id: g.id,
    layerId: g.layerId,
    name: g.name,
    isVisible: g.isVisible,
    isLocked: g.isLocked,
    order: g.order,
    categoryId: g.categoryId,
  }))
}

/**
 * Deserialize user groups from JSON import
 */
export function deserializeUserGroups(data: SerializedUserGroup[] | undefined): UserGroup[] {
  if (!data) return []
  return data.map((g) => ({
    id: g.id,
    layerId: g.layerId,
    name: g.name,
    isVisible: g.isVisible ?? true,
    isLocked: g.isLocked ?? false,
    order: g.order ?? 0,
    categoryId: g.categoryId ?? null,
  }))
}

/**
 * Serialize hull tiles for JSON export
 */
export function serializeHullTiles(hullTiles: ReadonlySet<string>): SerializedHullTile[] {
  const tiles: SerializedHullTile[] = []
  for (const key of hullTiles) {
    const [xStr, yStr] = key.split(',')
    tiles.push({ x: parseInt(xStr, 10), y: parseInt(yStr, 10) })
  }
  return tiles
}

/**
 * Deserialize hull tiles from JSON import
 */
export function deserializeHullTiles(data: SerializedHullTile[] | undefined): HullTile[] {
  if (!data) return []
  return data.map((t) => ({ x: t.x, y: t.y }))
}

/**
 * Create a project file object for saving
 */
export function createProjectFile(
  gridSize: GridSize,
  preset: string,
  structures: readonly PlacedStructure[],
  hullTiles: ReadonlySet<string>,
  userLayers?: readonly UserLayer[],
  userGroups?: readonly UserGroup[],
  activeLayerId?: string | null
): ProjectFile {
  return {
    version: PROJECT_VERSION,
    gridSize,
    preset,
    structures: serializeStructures(structures),
    hullTiles: serializeHullTiles(hullTiles),
    userLayers: userLayers ? serializeUserLayers(userLayers) : undefined,
    userGroups: userGroups ? serializeUserGroups(userGroups) : undefined,
    activeLayerId,
  }
}

/**
 * Validate and migrate a loaded project file
 */
export function parseProjectFile(data: unknown): ProjectFile {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid project file: not an object')
  }

  const obj = data as Record<string, unknown>

  // Check version (kept for future migrations)
  const version = typeof obj.version === 'number' ? obj.version : 1

  // Validate gridSize
  if (!obj.gridSize || typeof obj.gridSize !== 'object') {
    throw new Error('Invalid project file: missing gridSize')
  }

  const gridSize = obj.gridSize as Record<string, unknown>
  if (typeof gridSize.width !== 'number' || typeof gridSize.height !== 'number') {
    throw new Error('Invalid project file: invalid gridSize')
  }

  // Validate preset
  if (typeof obj.preset !== 'string') {
    throw new Error('Invalid project file: missing preset')
  }

  // Validate structures
  if (!Array.isArray(obj.structures)) {
    throw new Error('Invalid project file: structures is not an array')
  }

  // Migrate from v1 to v2 if needed, and add v4 org fields
  const structures: SerializedStructure[] = obj.structures.map((s: unknown) => {
    if (!s || typeof s !== 'object') {
      throw new Error('Invalid project file: invalid structure entry')
    }

    const struct = s as Record<string, unknown>

    // v1 used 'category' and 'item', v2 uses 'categoryId' and 'structureId'
    const categoryId = (struct.categoryId ?? struct.category) as string
    const structureId = (struct.structureId ?? struct.item) as string

    if (!categoryId || !structureId) {
      throw new Error('Invalid project file: structure missing category/item identifiers')
    }

    const layer = String(struct.layer ?? 'Hull')

    // v4+ org fields (will be migrated during deserialize if missing)
    const orgLayerId = struct.orgLayerId as string | undefined
    const orgGroupId = struct.orgGroupId as string | null | undefined

    return {
      id: String(struct.id ?? `migrated-${Math.random()}`),
      structureId,
      categoryId,
      x: Number(struct.x ?? 0),
      y: Number(struct.y ?? 0),
      rotation: (Number(struct.rotation) || 0) as Rotation,
      layer,
      orgLayerId,
      orgGroupId,
    }
  })

  // Parse hull tiles (v3+)
  const hullTiles: SerializedHullTile[] = []
  if (Array.isArray(obj.hullTiles)) {
    for (const tile of obj.hullTiles) {
      if (tile && typeof tile === 'object') {
        const t = tile as Record<string, unknown>
        if (typeof t.x === 'number' && typeof t.y === 'number') {
          hullTiles.push({ x: t.x, y: t.y })
        }
      }
    }
  }

  // Parse user layers (v4+)
  let userLayers: SerializedUserLayer[] | undefined
  if (version >= 4 && Array.isArray(obj.userLayers)) {
    userLayers = obj.userLayers.map((l: unknown) => {
      if (!l || typeof l !== 'object') {
        throw new Error('Invalid project file: invalid user layer entry')
      }
      const layer = l as Record<string, unknown>
      return {
        id: String(layer.id),
        name: String(layer.name),
        isVisible: layer.isVisible !== false,
        isLocked: layer.isLocked === true,
        order: Number(layer.order ?? 0),
      }
    })
  }

  // Parse user groups (v4+)
  let userGroups: SerializedUserGroup[] | undefined
  if (version >= 4 && Array.isArray(obj.userGroups)) {
    userGroups = obj.userGroups.map((g: unknown) => {
      if (!g || typeof g !== 'object') {
        throw new Error('Invalid project file: invalid user group entry')
      }
      const group = g as Record<string, unknown>
      return {
        id: String(group.id),
        layerId: String(group.layerId),
        name: String(group.name),
        isVisible: group.isVisible !== false,
        isLocked: group.isLocked === true,
        order: Number(group.order ?? 0),
        categoryId: group.categoryId as string | null | undefined,
      }
    })
  }

  return {
    version: PROJECT_VERSION,
    gridSize: {
      width: gridSize.width as number,
      height: gridSize.height as number,
    },
    preset: obj.preset as string,
    structures,
    hullTiles,
    userLayers,
    userGroups,
  }
}

/**
 * Download a project as JSON file
 */
export function downloadProjectJSON(project: ProjectFile, filename = 'spacehaven-ship.json'): void {
  const json = JSON.stringify(project, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()

  URL.revokeObjectURL(url)
}

/**
 * Load a project from a JSON file
 */
export function loadProjectFromFile(file: File): Promise<ProjectFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const text = event.target?.result
        if (typeof text !== 'string') {
          throw new Error('Failed to read file')
        }

        const data = JSON.parse(text)
        const project = parseProjectFile(data)
        resolve(project)
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsText(file)
  })
}

/**
 * Download a data URL as a file
 */
export function downloadDataURL(dataURL: string, filename: string): void {
  const link = document.createElement('a')
  link.href = dataURL
  link.download = filename
  link.click()
}
