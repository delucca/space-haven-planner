import type { StructureCatalog } from '@/data/types'

const STORAGE_KEY = 'space-haven-planner-catalog-cache'

/** Cache TTL: 7 days in milliseconds */
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Cached catalog data structure
 */
export interface CachedCatalogData {
  readonly catalog: StructureCatalog
  readonly fetchedAt: number
  readonly revisionKey: string
}

/**
 * Shape of the stored cache (for validation)
 */
interface StoredCache {
  catalog: unknown
  fetchedAt: unknown
  revisionKey: unknown
}

/**
 * Check if the cached catalog is stale (older than TTL)
 */
export function isStale(fetchedAt: number): boolean {
  return Date.now() - fetchedAt > CACHE_TTL_MS
}

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
 * Load cached catalog from localStorage
 * Returns null if no cache, invalid cache, or parse error
 */
export function loadCachedCatalog(): CachedCatalogData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    const parsed: unknown = JSON.parse(stored)
    if (!parsed || typeof parsed !== 'object') return null

    const data = parsed as StoredCache

    // Validate required fields
    if (typeof data.fetchedAt !== 'number') return null
    if (typeof data.revisionKey !== 'string') return null
    if (!isValidCatalog(data.catalog)) return null

    return {
      catalog: data.catalog as StructureCatalog,
      fetchedAt: data.fetchedAt,
      revisionKey: data.revisionKey,
    }
  } catch (err) {
    console.warn('Failed to load catalog cache:', err)
    return null
  }
}

/**
 * Save catalog to localStorage cache
 */
export function saveCachedCatalog(catalog: StructureCatalog, revisionKey: string): void {
  try {
    const data: CachedCatalogData = {
      catalog,
      fetchedAt: Date.now(),
      revisionKey,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (err) {
    console.warn('Failed to save catalog cache:', err)
  }
}

/**
 * Clear the catalog cache
 */
export function clearCatalogCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.warn('Failed to clear catalog cache:', err)
  }
}

/**
 * Get the current revision key from cache (if any)
 * Useful for conditional fetching
 */
export function getCachedRevisionKey(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    const parsed: unknown = JSON.parse(stored)
    if (!parsed || typeof parsed !== 'object') return null

    const data = parsed as StoredCache
    if (typeof data.revisionKey !== 'string') return null

    return data.revisionKey
  } catch {
    return null
  }
}


