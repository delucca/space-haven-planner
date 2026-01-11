/**
 * Cache management for JAR-derived catalog
 *
 * Stores the user's parsed JAR catalog in localStorage
 * so they don't need to re-upload on every visit.
 */

import type { StructureCatalog } from '@/data/types'
import type { JarSourceInfo, JarCatalogData } from './types'

const STORAGE_KEY = 'space-haven-planner-jar-catalog'

/**
 * Shape of the stored cache (for validation)
 */
interface StoredJarCache {
  catalog: unknown
  sourceInfo: unknown
  version: number
}

/**
 * Current cache version - bump when format changes
 */
const CACHE_VERSION = 1

/**
 * Validate that a value looks like a valid StructureCatalog
 */
function isValidCatalog(value: unknown): value is StructureCatalog {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  if (!Array.isArray(obj.categories)) return false

  // Basic validation: check that categories have expected shape
  for (const cat of obj.categories) {
    if (!cat || typeof cat !== 'object') return false
    const category = cat as Record<string, unknown>
    if (typeof category.id !== 'string') return false
    if (typeof category.name !== 'string') return false
    if (!Array.isArray(category.items)) return false
  }

  return true
}

/**
 * Validate source info structure
 */
function isValidSourceInfo(value: unknown): value is JarSourceInfo {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>

  return (
    typeof obj.fileName === 'string' &&
    typeof obj.fileSize === 'number' &&
    typeof obj.lastModified === 'number' &&
    typeof obj.extractedAt === 'number'
  )
}

/**
 * Load cached JAR catalog from localStorage
 * Returns null if no cache, invalid cache, or parse error
 */
export function loadCachedJarCatalog(): JarCatalogData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    const parsed: unknown = JSON.parse(stored)
    if (!parsed || typeof parsed !== 'object') return null

    const data = parsed as StoredJarCache

    // Check version
    if (data.version !== CACHE_VERSION) {
      console.warn('JAR catalog cache version mismatch, clearing')
      clearJarCatalogCache()
      return null
    }

    // Validate fields
    if (!isValidCatalog(data.catalog)) return null
    if (!isValidSourceInfo(data.sourceInfo)) return null

    return {
      catalog: data.catalog as StructureCatalog,
      sourceInfo: data.sourceInfo as JarSourceInfo,
    }
  } catch (err) {
    console.warn('Failed to load JAR catalog cache:', err)
    return null
  }
}

/**
 * Save JAR catalog to localStorage cache
 */
export function saveJarCatalogCache(catalog: StructureCatalog, sourceInfo: JarSourceInfo): void {
  try {
    const data: StoredJarCache = {
      catalog,
      sourceInfo,
      version: CACHE_VERSION,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (err) {
    console.warn('Failed to save JAR catalog cache:', err)
  }
}

/**
 * Clear the JAR catalog cache
 */
export function clearJarCatalogCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.warn('Failed to clear JAR catalog cache:', err)
  }
}

/**
 * Check if a cached JAR catalog exists
 */
export function hasJarCatalogCache(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return false
  }
}

/**
 * Get source info from cache without loading full catalog
 */
export function getCachedJarSourceInfo(): JarSourceInfo | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    const parsed: unknown = JSON.parse(stored)
    if (!parsed || typeof parsed !== 'object') return null

    const data = parsed as StoredJarCache

    if (data.version !== CACHE_VERSION) return null
    if (!isValidSourceInfo(data.sourceInfo)) return null

    return data.sourceInfo as JarSourceInfo
  } catch {
    return null
  }
}
