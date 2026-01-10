/**
 * Types for Space Haven JAR catalog parsing
 */

import type { StructureCatalog } from '@/data/types'

/**
 * Raw tile data extracted from <data> section
 */
export interface RawJarTile {
  /** X offset from structure origin (gridOffX) */
  readonly gridOffX: number
  /** Y offset from structure origin (gridOffY) */
  readonly gridOffY: number
  /** Element type (Object, Floor, Hull, Door, Light, etc.) */
  readonly elementType: string
  /** Walk grid cost (255=blocked, 1=normal, 0=free) */
  readonly walkGridCost: number
}

/**
 * Raw linked element from <linked> section
 * These define the actual construction tiles that make up the structure
 */
export interface RawJarLinkedTile {
  /** Reference ID to another element */
  readonly id: number
  /** Element ID within this structure */
  readonly eid: number
  /** X offset from structure origin */
  readonly gridOffX: number
  /** Y offset from structure origin */
  readonly gridOffY: number
  /** Rotation (R0, R90, R180, R270) */
  readonly rot: string
}

/**
 * Raw restriction tile (required floor/space around structure)
 */
export interface RawJarRestriction {
  /** Type of restriction (Floor, Space, etc.) */
  readonly type: string
  /** X offset */
  readonly gridX: number
  /** Y offset */
  readonly gridY: number
  /** Width of restriction area */
  readonly sizeX: number
  /** Height of restriction area */
  readonly sizeY: number
}

/**
 * Raw structure data extracted from library/haven XML
 */
export interface RawJarStructure {
  /** Unique ID from mid attribute */
  readonly mid: number
  /** Name text ID from objectInfo/name[@tid] */
  readonly nameTid: number
  /** Subcategory ID from objectInfo/subCat[@id] */
  readonly subCatId: number | null
  /** Size calculated from linked elements or data tiles */
  readonly size: { width: number; height: number } | null
  /** Raw _name attribute if present (for debugging) */
  readonly debugName: string | null
  /** Detailed tile data from <data> section */
  readonly tiles: readonly RawJarTile[]
  /** Linked elements that define the structure's construction footprint */
  readonly linkedTiles: readonly RawJarLinkedTile[]
  /** Restriction tiles (required floor/space around structure) */
  readonly restrictions: readonly RawJarRestriction[]
}

/**
 * Text entry from library/texts XML
 */
export interface TextEntry {
  readonly id: number
  readonly en: string
}

/**
 * Category definition from library/haven XML
 */
export interface RawJarCategory {
  readonly id: number
  readonly nameTid: number
  readonly parentId: number | null
}

/**
 * Parsed JAR data before catalog conversion
 */
export interface ParsedJarData {
  readonly structures: readonly RawJarStructure[]
  readonly texts: ReadonlyMap<number, string>
  readonly categories: readonly RawJarCategory[]
  readonly gameVersion: string | null
}

/**
 * Source info for tracking JAR origin
 */
export interface JarSourceInfo {
  readonly fileName: string
  readonly fileSize: number
  readonly lastModified: number
  readonly extractedAt: number
  readonly gameVersion: string | null
}

/**
 * Complete JAR catalog with metadata
 */
export interface JarCatalogData {
  readonly catalog: StructureCatalog
  readonly sourceInfo: JarSourceInfo
}

/**
 * Catalog source types for JAR-based system
 */
export type JarCatalogSource =
  | 'jar_builtin_snapshot' // Built-in catalog shipped with the app
  | 'jar_user' // Freshly parsed from user-uploaded JAR
  | 'jar_user_cache' // Loaded from localStorage (user's previous JAR)
