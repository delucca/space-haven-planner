/**
 * Types for Space Haven JAR catalog parsing
 */

import type { StructureCatalog } from '@/data/types'

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
  /** Size extracted from restrictions (sizeX × sizeY) */
  readonly size: { width: number; height: number } | null
  /** Raw _name attribute if present (for debugging) */
  readonly debugName: string | null
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

