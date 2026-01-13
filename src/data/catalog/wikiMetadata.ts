/**
 * Wiki Metadata Service
 *
 * Provides supplemental metadata from the Space Haven wiki.
 * This is NOT used for building the catalog - the JAR file is the primary source.
 * Instead, this provides:
 * - Structure images
 * - Extended descriptions
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
 * Cache key for wiki metadata (batch)
 */
const METADATA_CACHE_KEY = 'space-haven-planner-wiki-metadata'

/**
 * Cache key prefix for per-structure metadata
 */
const STRUCTURE_CACHE_KEY_PREFIX = 'space-haven-planner-wiki-structure-'

/**
 * Cache TTL: 24 hours
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Cached metadata structure (batch)
 */
interface CachedMetadata {
  readonly data: Record<string, WikiStructureMetadata>
  readonly fetchedAt: number
}

/**
 * Result status for per-structure lookup
 */
export type WikiStructureLookupStatus = 'found' | 'missing' | 'loading' | 'error'

/**
 * Per-structure cache entry (supports positive + negative caching)
 */
interface PerStructureCacheEntry {
  readonly status: 'found' | 'missing'
  readonly metadata: WikiStructureMetadata | null
  readonly fetchedAt: number
}

/**
 * Result of per-structure wiki metadata lookup
 */
export interface WikiStructureLookupResult {
  readonly status: WikiStructureLookupStatus
  readonly metadata: WikiStructureMetadata | null
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
  images?: Array<{ ns: number; title: string }>
}

interface WikiImageInfo {
  title: string
  missing?: boolean
  imageinfo?: Array<{ url: string }>
}

interface WikiPageQueryResponse {
  query?: {
    pages?: WikiPageInfo[]
  }
}

interface WikiImageQueryResponse {
  query?: {
    pages?: WikiImageInfo[]
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

    const data: WikiPageQueryResponse = await response.json()
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

// =============================================================================
// Per-structure lookup with positive + negative caching
// =============================================================================

/**
 * Generate cache key for a structure name
 */
function getStructureCacheKey(structureName: string): string {
  return STRUCTURE_CACHE_KEY_PREFIX + structureName.toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

/**
 * Load per-structure cache entry from localStorage
 */
function loadStructureCacheEntry(structureName: string): PerStructureCacheEntry | null {
  try {
    const key = getStructureCacheKey(structureName)
    const stored = localStorage.getItem(key)
    if (!stored) return null

    const parsed = JSON.parse(stored) as PerStructureCacheEntry
    if (
      (parsed.status !== 'found' && parsed.status !== 'missing') ||
      typeof parsed.fetchedAt !== 'number'
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

/**
 * Save per-structure cache entry to localStorage
 */
function saveStructureCacheEntry(
  structureName: string,
  status: 'found' | 'missing',
  metadata: WikiStructureMetadata | null
): void {
  try {
    const key = getStructureCacheKey(structureName)
    const entry: PerStructureCacheEntry = {
      status,
      metadata,
      fetchedAt: Date.now(),
    }
    localStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Build MediaWiki API URL for fetching a single page with redirects and images list
 */
function buildSinglePageInfoUrl(title: string): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    formatversion: '2',
    prop: 'revisions|images',
    rvprop: 'ids',
    imlimit: '20', // Get up to 20 images from the page
    redirects: '1', // Follow redirects
    titles: title,
  })
  return `${WIKI_API_URL}?${params.toString()}`
}

/**
 * Build MediaWiki API URL for fetching image info (actual URL) for a file
 * We request a thumbnail URL (scale-to-width-down) which works better with CORS
 */
function buildImageInfoUrl(fileTitle: string): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    formatversion: '2',
    prop: 'imageinfo',
    iiprop: 'url',
    // Request a thumbnail - this uses a different CDN path that works better
    iiurlwidth: '200',
    titles: fileTitle,
  })
  return `${WIKI_API_URL}?${params.toString()}`
}

/**
 * Transform a Fandom image URL to use the thumbnail format
 * This helps bypass some CDN restrictions
 */
function toThumbnailUrl(url: string): string {
  // If URL already has scale-to-width-down, return as-is
  if (url.includes('scale-to-width-down')) {
    return url
  }

  // Transform: .../revision/latest?cb=... to .../revision/latest/scale-to-width-down/200?cb=...
  const match = url.match(/^(.+\/revision\/latest)(\?cb=.+)?$/)
  if (match) {
    const base = match[1]
    const cb = match[2] || ''
    return `${base}/scale-to-width-down/200${cb}`
  }

  return url
}

/**
 * Normalize a string for fuzzy matching (remove spaces, lowercase, remove special chars)
 */
function normalizeForMatching(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Find the best matching image file from a list of images on a wiki page
 * Prioritizes images whose filename matches the structure name
 */
function findBestMatchingImage(
  structureName: string,
  images: Array<{ ns: number; title: string }>
): string | null {
  if (!images || images.length === 0) return null

  const normalizedName = normalizeForMatching(structureName)

  // Filter to only image files (File: namespace)
  const imageFiles = images.filter((img) => img.title.startsWith('File:'))

  if (imageFiles.length === 0) return null

  // Score each image based on how well it matches the structure name
  const scored = imageFiles.map((img) => {
    // Remove "File:" prefix and extension for matching
    const filename = img.title.replace(/^File:/, '').replace(/\.[^.]+$/, '')
    const normalizedFilename = normalizeForMatching(filename)

    let score = 0

    // Exact match (highest priority)
    if (normalizedFilename === normalizedName) {
      score = 100
    }
    // Filename contains the structure name
    else if (normalizedFilename.includes(normalizedName)) {
      score = 80
    }
    // Structure name contains the filename
    else if (normalizedName.includes(normalizedFilename)) {
      score = 60
    }
    // Partial word overlap
    else {
      const nameWords = structureName.toLowerCase().split(/\s+/)
      const filenameWords = filename.toLowerCase().split(/(?=[A-Z])|\s+/)
      const matchingWords = nameWords.filter((word) =>
        filenameWords.some((fw) => fw.includes(word) || word.includes(fw))
      )
      score = matchingWords.length * 20
    }

    // Penalize generic images (footprint, icon, etc.)
    const lowerFilename = filename.toLowerCase()
    if (lowerFilename.includes('footprint') || lowerFilename.includes('icon')) {
      score -= 10
    }
    // Penalize facility block images (FB prefix)
    if (lowerFilename.startsWith('fb') || lowerFilename.startsWith('FB')) {
      score -= 30
    }

    return { title: img.title, score }
  })

  // Sort by score descending and return the best match
  scored.sort((a, b) => b.score - a.score)

  // Only return if we have a reasonable match (score > 0)
  return scored[0]?.score > 0 ? scored[0].title : null
}

/**
 * Fetch the actual URL for an image file
 * Returns a thumbnail URL that works better with browser CORS restrictions
 */
async function fetchImageUrl(fileTitle: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const url = buildImageInfoUrl(fileTitle)
    const response = await fetch(url, { signal })

    if (!response.ok) return null

    const data: WikiImageQueryResponse = await response.json()
    const pages = data.query?.pages

    if (!pages || pages.length === 0) return null

    const page = pages[0]
    if (page.missing) return null

    const imageInfo = page.imageinfo?.[0]
    const imageUrl = imageInfo?.url ?? null

    // Transform to thumbnail URL for better CORS compatibility
    return imageUrl ? toThumbnailUrl(imageUrl) : null
  } catch {
    return null
  }
}

/**
 * Fetch wiki metadata for a single structure name
 * Returns the metadata if found, null if missing/error
 *
 * This function:
 * 1. Fetches page info including the list of images on the page
 * 2. Finds the best matching image based on the structure name
 * 3. Fetches the actual URL for that image
 */
async function fetchSingleStructureMetadata(
  structureName: string,
  signal?: AbortSignal
): Promise<WikiStructureMetadata | null> {
  try {
    const url = buildSinglePageInfoUrl(structureName)
    const response = await fetch(url, { signal })

    if (!response.ok) {
      console.warn(`Wiki metadata fetch failed for "${structureName}": ${response.status}`)
      return null
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      console.warn('Wiki API returned non-JSON response')
      return null
    }

    const data: WikiPageQueryResponse = await response.json()
    const pages = data.query?.pages

    if (!pages || pages.length === 0) {
      return null
    }

    const page = pages[0]
    if (page.missing) {
      return null
    }

    const revisionId = page.revisions?.[0]?.revid ?? 0

    // Find the best matching image from the page's images
    let imageUrl: string | null = null
    if (page.images && page.images.length > 0) {
      const bestImageTitle = findBestMatchingImage(structureName, page.images)
      if (bestImageTitle) {
        imageUrl = await fetchImageUrl(bestImageTitle, signal)
      }
    }

    return {
      pageTitle: page.title,
      pageUrl: getWikiPageUrl(page.title),
      imageUrl,
      description: null, // We removed extracts since Fandom doesn't support it
      revisionId,
    }
  } catch (error) {
    // Don't log abort errors
    if (error instanceof Error && error.name === 'AbortError') {
      return null
    }
    console.warn(`Wiki metadata fetch error for "${structureName}":`, error)
    return null
  }
}

/**
 * Get wiki metadata for a single structure with caching (positive + negative)
 *
 * This function:
 * 1. Checks localStorage cache for the structure name
 * 2. If cached (found or missing) and not stale, returns cached result
 * 3. Otherwise fetches from wiki API and caches the result
 *
 * @param structureName - The structure name to look up
 * @param signal - Optional AbortSignal to cancel the request
 * @returns Promise resolving to lookup result with status and optional metadata
 */
export async function getWikiMetadataForStructure(
  structureName: string,
  signal?: AbortSignal
): Promise<WikiStructureLookupResult> {
  // Check per-structure cache first
  const cached = loadStructureCacheEntry(structureName)
  if (cached && !isMetadataCacheStale(cached.fetchedAt)) {
    return {
      status: cached.status,
      metadata: cached.metadata,
    }
  }

  // NOTE: We intentionally skip the batch cache here because it uses the old
  // pageimages API which returns incorrect images (e.g., FBComfort.png instead
  // of JukeBox.png for the Jukebox page). The per-structure cache uses the
  // new image matching logic which finds the correct image.

  // Fetch from wiki API
  const metadata = await fetchSingleStructureMetadata(structureName, signal)

  if (metadata) {
    saveStructureCacheEntry(structureName, 'found', metadata)
    return { status: 'found', metadata }
  }

  // Cache the negative result (missing)
  saveStructureCacheEntry(structureName, 'missing', null)
  return { status: 'missing', metadata: null }
}

/**
 * Clear per-structure cache entry
 * Useful for forcing a refresh
 */
export function clearStructureCacheEntry(structureName: string): void {
  try {
    const key = getStructureCacheKey(structureName)
    localStorage.removeItem(key)
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear all wiki metadata caches (both batch and per-structure)
 * Useful for forcing a refresh of all wiki data
 */
export function clearAllWikiCaches(): void {
  try {
    // Clear batch cache
    localStorage.removeItem(METADATA_CACHE_KEY)

    // Clear all per-structure caches
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(STRUCTURE_CACHE_KEY_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key))
  } catch {
    // Ignore storage errors
  }
}
