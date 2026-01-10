/**
 * Core domain types for Space Haven Planner
 */

/** Rotation angle in degrees (clockwise) */
export type Rotation = 0 | 90 | 180 | 270

/** Layer identifiers - structures are organized by layer for visibility control */
export type LayerId = 'Hull' | 'Rooms' | 'Systems' | 'Furniture'

/** Tool identifiers for interaction modes */
export type ToolId = 'place' | 'erase' | 'hull'

/** A hull tile position (1x1 basic hull block) */
export interface HullTile {
  readonly x: number
  readonly y: number
}

/**
 * Tile type within a structure's footprint
 * - 'construction': Main structure body (solid, blocks placement)
 * - 'blocked': Required space but not walkable (e.g., airlock exterior)
 * - 'access': Walkable tile, can place floor items on top
 */
export type TileType = 'construction' | 'blocked' | 'access'

/**
 * A single tile within a structure's footprint
 * Position is relative to the structure's origin (0,0)
 */
export interface StructureTile {
  /** X offset from structure origin */
  readonly x: number
  /** Y offset from structure origin */
  readonly y: number
  /** Type of tile (affects rendering and placement rules) */
  readonly type: TileType
  /**
   * Walk grid cost from JAR data
   * - 255 = blocked (can't walk)
   * - 1 = normal walkable
   * - 0 = free access
   */
  readonly walkCost: number
}

/**
 * Complete tile layout for a structure
 * Maps relative positions to tile info
 */
export interface TileLayout {
  /** All tiles that make up this structure */
  readonly tiles: readonly StructureTile[]
  /** Bounding box width (may differ from simple size due to irregular shapes) */
  readonly width: number
  /** Bounding box height */
  readonly height: number
}

/** 2D size in tiles [width, height] */
export type Size = readonly [width: number, height: number]

/** 2D position in tile coordinates */
export interface Position {
  readonly x: number
  readonly y: number
}

/** Grid dimensions in tiles */
export interface GridSize {
  readonly width: number
  readonly height: number
}

/** Grid preset with label and dimensions */
export interface GridPreset {
  readonly label: string
  readonly width: number
  readonly height: number
}

/** Definition of a structure type (from catalog) */
export interface StructureDef {
  readonly id: string
  readonly name: string
  readonly size: Size
  readonly color: string
  readonly categoryId: string
  /**
   * Detailed tile layout (optional - may not be available for all structures)
   * If present, provides per-tile information for accurate rendering
   * If absent, the entire size is treated as construction tiles
   */
  readonly tileLayout?: TileLayout
}

/** Category of structures in the catalog */
export interface StructureCategory {
  readonly id: string
  readonly name: string
  readonly color: string
  readonly defaultLayer: LayerId
  readonly items: readonly StructureDef[]
}

/** Full structure catalog */
export interface StructureCatalog {
  readonly categories: readonly StructureCategory[]
}

/** A structure placed on the grid */
export interface PlacedStructure {
  readonly id: string
  readonly structureId: string
  readonly categoryId: string
  readonly x: number
  readonly y: number
  readonly rotation: Rotation
  readonly layer: LayerId
}

/** Axis-aligned bounding box for collision detection */
export interface BoundingBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * Get the effective size of a structure considering rotation
 */
export function getRotatedSize(size: Size, rotation: Rotation): Size {
  if (rotation === 90 || rotation === 270) {
    return [size[1], size[0]]
  }
  return size
}

/**
 * Get bounding box for a placed structure
 */
export function getStructureBounds(
  structure: PlacedStructure,
  structureDef: StructureDef
): BoundingBox {
  const [width, height] = getRotatedSize(structureDef.size, structure.rotation)
  return {
    x: structure.x,
    y: structure.y,
    width,
    height,
  }
}
