/**
 * Wiki Metadata Service
 *
 * Provides supplemental metadata from the Space Haven wiki.
 * This is NOT used for building the catalog - the JAR file is the primary source.
 * Instead, this provides:
 * - Structure images (future)
 * - Extended descriptions (future)
 * - Wiki page links
 *
 * Metadata is keyed by structure name for correlation with JAR-derived structures.
 */

/**
 * MediaWiki API base URL for Space Haven wiki
 */
const WIKI_API_URL = 'https://spacehaven.fandom.com/api.php'

/**
 * Metadata about a structure from the wiki
 */
export interface WikiStructureMetadata {
  /** Wiki page title */
  readonly pageTitle: string
  /** URL to the wiki page */
  readonly pageUrl: string
  /** URL to the main image (if available) */
  readonly imageUrl: string | null
  /** Short description/excerpt */
  readonly description: string | null
  /** Wiki page revision ID for cache invalidation */
  readonly revisionId: number
}

/**
 * Cache key for wiki metadata
 */
const METADATA_CACHE_KEY = 'space-haven-planner-wiki-metadata'

/**
 * Cache TTL: 24 hours
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Cached metadata structure
 */
interface CachedMetadata {
  readonly data: Record<string, WikiStructureMetadata>
  readonly fetchedAt: number
}

/**
 * Load cached wiki metadata from localStorage
 */
export function loadCachedMetadata(): CachedMetadata | null {
  try {
    const stored = localStorage.getItem(METADATA_CACHE_KEY)
    if (!stored) return null

    const parsed = JSON.parse(stored) as CachedMetadata
    if (!parsed.data || typeof parsed.fetchedAt !== 'number') {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

/**
 * Save wiki metadata to localStorage cache
 */
export function saveCachedMetadata(data: Record<string, WikiStructureMetadata>): void {
  try {
    const cache: CachedMetadata = {
      data,
      fetchedAt: Date.now(),
    }
    localStorage.setItem(METADATA_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Check if cached metadata is stale
 */
export function isMetadataCacheStale(fetchedAt: number): boolean {
  return Date.now() - fetchedAt > CACHE_TTL_MS
}

/**
 * Normalize a structure name for matching
 * Handles variations like "Power Generator X1" vs "X1 Power Generator"
 */
export function normalizeStructureName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .sort()
    .join(' ')
}

/**
 * Generate wiki page URL from title
 */
function getWikiPageUrl(pageTitle: string): string {
  const encoded = encodeURIComponent(pageTitle.replace(/ /g, '_'))
  return `https://spacehaven.fandom.com/wiki/${encoded}`
}

/**
 * Build MediaWiki API URL for fetching page info with images
 */
function buildPageInfoUrl(titles: string[]): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    formatversion: '2',
    prop: 'revisions|pageimages|extracts',
    rvprop: 'ids',
    piprop: 'original',
    exintro: '1',
    explaintext: '1',
    exsentences: '2',
    titles: titles.join('|'),
  })
  return `${WIKI_API_URL}?${params.toString()}`
}

/**
 * MediaWiki API response types
 */
interface WikiPageInfo {
  pageid?: number
  title: string
  missing?: boolean
  revisions?: Array<{ revid: number }>
  original?: { source: string }
  extract?: string
}

interface WikiQueryResponse {
  query?: {
    pages?: WikiPageInfo[]
  }
}

/**
 * Fetch metadata for a batch of structure names from the wiki
 */
async function fetchMetadataBatch(names: string[]): Promise<Map<string, WikiStructureMetadata>> {
  const results = new Map<string, WikiStructureMetadata>()

  try {
    const url = buildPageInfoUrl(names)
    const response = await fetch(url)

    if (!response.ok) {
      console.warn(`Wiki metadata fetch failed: ${response.status}`)
      return results
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      console.warn('Wiki API returned non-JSON response')
      return results
    }

    const data: WikiQueryResponse = await response.json()
    const pages = data.query?.pages

    if (!pages) {
      return results
    }

    for (const page of pages) {
      if (page.missing) continue

      const revisionId = page.revisions?.[0]?.revid ?? 0
      const metadata: WikiStructureMetadata = {
        pageTitle: page.title,
        pageUrl: getWikiPageUrl(page.title),
        imageUrl: page.original?.source ?? null,
        description: page.extract ?? null,
        revisionId,
      }

      results.set(page.title.toLowerCase(), metadata)
    }
  } catch (error) {
    console.warn('Wiki metadata fetch error:', error)
  }

  return results
}

/**
 * Fetch wiki metadata for a list of structure names
 * Returns a map keyed by normalized structure name
 */
export async function fetchWikiMetadata(
  structureNames: string[]
): Promise<Record<string, WikiStructureMetadata>> {
  const results: Record<string, WikiStructureMetadata> = {}
  const BATCH_SIZE = 50

  for (let i = 0; i < structureNames.length; i += BATCH_SIZE) {
    const batch = structureNames.slice(i, i + BATCH_SIZE)
    const batchResults = await fetchMetadataBatch(batch)

    for (const [key, value] of batchResults) {
      results[key] = value
    }
  }

  return results
}

/**
 * Look up wiki metadata for a structure by name
 * Tries exact match first, then normalized match
 */
export function findMetadataForStructure(
  structureName: string,
  metadata: Record<string, WikiStructureMetadata>
): WikiStructureMetadata | null {
  // Try exact match (lowercase)
  const exact = metadata[structureName.toLowerCase()]
  if (exact) return exact

  // Try normalized match
  const normalized = normalizeStructureName(structureName)
  for (const [key, value] of Object.entries(metadata)) {
    if (normalizeStructureName(key) === normalized) {
      return value
    }
  }

  return null
}

/**
 * Get or fetch wiki metadata with caching
 */
export async function getWikiMetadata(
  structureNames: string[]
): Promise<Record<string, WikiStructureMetadata>> {
  // Check cache first
  const cached = loadCachedMetadata()
  if (cached && !isMetadataCacheStale(cached.fetchedAt)) {
    return cached.data
  }

  // Fetch fresh data
  const fresh = await fetchWikiMetadata(structureNames)

  // Cache for future use
  saveCachedMetadata(fresh)

  return fresh
}

