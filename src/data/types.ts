/**
 * Core domain types for Space Haven Planner
 */

/** Rotation angle in degrees (clockwise) */
export type Rotation = 0 | 90 | 180 | 270

/** Layer identifiers - structures are organized by layer for visibility control */
export type LayerId = 'Hull' | 'Rooms' | 'Systems' | 'Furniture'

/** Tool identifiers for interaction modes */
export type ToolId = 'place' | 'erase'

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

