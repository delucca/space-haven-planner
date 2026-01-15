import type { Rotation } from '@/data/types'

/**
 * Metadata about a ship parsed from a Space Haven save file
 */
export interface ParsedShipMeta {
  /** Ship ID (sid attribute) */
  readonly sid: string
  /** Ship name (sname attribute) */
  readonly name: string
  /** Ship grid width in tiles (sx attribute) */
  readonly width: number
  /** Ship grid height in tiles (sy attribute) */
  readonly height: number
  /** Whether this ship is owned by the player */
  readonly isPlayerOwned: boolean
}

/**
 * A tile element from the save file
 * These represent individual tiles on the ship grid
 */
export interface ParsedTileElement {
  /** X coordinate on ship grid */
  readonly x: number
  /** Y coordinate on ship grid */
  readonly y: number
  /** Structure/tile type ID (m attribute) */
  readonly mid: number
  /** Rotation (rot attribute, e.g., "R0", "R90", "R180", "R270") */
  readonly rotation: Rotation
  /** Whether this is a multi-tile structure (has child <l> elements) */
  readonly isMultiTile: boolean
  /** Child tile positions for multi-tile structures */
  readonly childTiles?: readonly ParsedChildTile[]
}

/**
 * A child tile within a multi-tile structure
 */
export interface ParsedChildTile {
  /** Index within the structure (ind attribute) */
  readonly index: number
  /** X coordinate on ship grid */
  readonly x: number
  /** Y coordinate on ship grid */
  readonly y: number
}

/**
 * Fully parsed ship data from a save file
 */
export interface ParsedShip {
  /** Ship metadata */
  readonly meta: ParsedShipMeta
  /** All tile elements in the ship */
  readonly elements: readonly ParsedTileElement[]
}

/**
 * Result of parsing a save file
 */
export interface SaveParseResult {
  /** All ships found in the save (player and NPC) */
  readonly allShips: readonly ParsedShipMeta[]
  /** Only player-owned ships */
  readonly playerShips: readonly ParsedShipMeta[]
  /** The raw XML document for further processing */
  readonly xmlDoc: Document
}

/**
 * Parse rotation string to Rotation type
 */
export function parseRotation(rotStr: string | null): Rotation {
  switch (rotStr) {
    case 'R90':
      return 90
    case 'R180':
      return 180
    case 'R270':
      return 270
    case 'R0':
    default:
      return 0
  }
}



