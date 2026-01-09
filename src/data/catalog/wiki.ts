import type { StructureCatalog, StructureDef, StructureCategory, Size, LayerId } from '@/data/types'
import { STATIC_CATALOG } from './structures'

/**
 * MediaWiki API base URL for Space Haven wiki
 */
const WIKI_API_URL = 'https://spacehaven.fandom.com/api.php'

/**
 * Wiki categories that contain building/structure pages
 * We fetch from multiple categories to get comprehensive coverage
 */
const STRUCTURE_CATEGORIES = [
  'Category:Facilities',
  'Category:Power',
  'Category:System',
  'Category:Production Facilities',
]

/**
 * Pages to explicitly skip (meta pages, resources, non-placeable items)
 */
const SKIP_PAGES = new Set([
  // Meta/overview pages
  'facilities',
  'resources',
  'items',
  'characters',
  'factions',
  'gameplay',
  'decorations',
  'foods',
  'vehicles',
  'spaceship',
  // Resource pages (not placeable structures)
  'base metals',
  'noble metals',
  'carbon',
  'energium',
  'hyperium',
  'hyperfuel',
  'energy rod',
  'energy block',
  'energy scrap',
  'hull block',
  'hull scrap',
  'infra scrap',
  'infrablock',
  'superblock',
  'techblock',
  'soft block',
  'soft scrap',
  'tech scrap',
  'steel plates',
  'fabrics',
  'fibers',
  'fertilizer',
  'water',
  'water vapor',
  'ice',
  'raw chemicals',
  'electronics component',
  'optronics component',
  'quantronics component',
  'building tools',
  'medical supplies',
  'iv fluid',
  'armor',
  'artificial meat',
  'human meat',
  'monster meat',
  'human organs',
  'processed food',
  'space food',
  'fruits',
  'nuts and seeds',
  'root vegetables',
  // Game mechanics pages
  'comfort',
  'trade',
  'traits',
  'time',
  'mass',
  'research',
  'sandbox mode',
  'system point',
  'tiles',
  // Data logs
  'data log',
  'data log - call me crazy',
  'data log - irs mary shelley',
  'data log - starfarer',
  'data log - the apocalypse',
  'data log - tranquility',
  // Encounters/misc
  'derelict',
  'asteroid',
  'nebula',
  'the fog',
  // Vehicles (not placeable)
  'miner',
  'shuttle',
  // Weapons (items, not structures)
  'ballistic weapons',
  'energy weapons',
  'rocket',
  // Wiki meta
  'main page',
  'space haven',
  'space haven wiki',
  'space haven soundtrack',
  'test',
  'utility items',
  // Version pages
  'version 0.8.20',
  'version 0.8.21',
])

/**
 * Result of fetching wiki data
 */
export interface WikiFetchResult {
  catalog: StructureCatalog
  revisionKey: string
}

/**
 * Parsed structure data from wiki page
 */
interface ParsedStructureData {
  name: string
  footprint: { width: number; height: number } | null
  category: string | null
  color: string | null
}

/**
 * Mapping of wiki category names to our internal category IDs and layer assignments
 */
const WIKI_CATEGORY_MAP: Record<string, { categoryId: string; layer: LayerId }> = {
  // Power-related
  power: { categoryId: 'power', layer: 'Systems' },
  generators: { categoryId: 'power', layer: 'Systems' },
  'power nodes': { categoryId: 'power', layer: 'Systems' },

  // Life support
  'life support': { categoryId: 'life_support', layer: 'Systems' },
  'thermal regulators': { categoryId: 'life_support', layer: 'Systems' },
  oxygen: { categoryId: 'life_support', layer: 'Systems' },

  // Systems & Combat
  system: { categoryId: 'system', layer: 'Systems' },
  weapons: { categoryId: 'system', layer: 'Systems' },
  shields: { categoryId: 'system', layer: 'Systems' },
  turrets: { categoryId: 'system', layer: 'Systems' },
  combat: { categoryId: 'system', layer: 'Systems' },

  // Hull
  hull: { categoryId: 'hull', layer: 'Hull' },
  walls: { categoryId: 'hull', layer: 'Hull' },
  doors: { categoryId: 'hull', layer: 'Hull' },

  // Airlock & Hangar
  airlock: { categoryId: 'airlock', layer: 'Rooms' },
  hangar: { categoryId: 'airlock', layer: 'Rooms' },

  // Storage
  storage: { categoryId: 'storage', layer: 'Rooms' },

  // Food & Agriculture
  food: { categoryId: 'food', layer: 'Rooms' },
  kitchen: { categoryId: 'food', layer: 'Rooms' },
  agriculture: { categoryId: 'food', layer: 'Rooms' },
  'grow bed': { categoryId: 'food', layer: 'Rooms' },

  // Resource & Industry
  resource: { categoryId: 'resource', layer: 'Rooms' },
  industry: { categoryId: 'resource', layer: 'Rooms' },
  production: { categoryId: 'resource', layer: 'Rooms' },
  refinery: { categoryId: 'resource', layer: 'Rooms' },
  fabricator: { categoryId: 'resource', layer: 'Rooms' },
  assembler: { categoryId: 'resource', layer: 'Rooms' },

  // Crew Facilities
  facility: { categoryId: 'facility', layer: 'Rooms' },
  facilities: { categoryId: 'facility', layer: 'Rooms' },
  crew: { categoryId: 'facility', layer: 'Rooms' },
  medical: { categoryId: 'facility', layer: 'Rooms' },
  research: { categoryId: 'facility', layer: 'Rooms' },
  bed: { categoryId: 'facility', layer: 'Rooms' },
  entertainment: { categoryId: 'facility', layer: 'Rooms' },

  // Robots
  robots: { categoryId: 'robots', layer: 'Systems' },
  robot: { categoryId: 'robots', layer: 'Systems' },

  // Furniture & Decoration
  furniture: { categoryId: 'furniture', layer: 'Furniture' },
  decoration: { categoryId: 'furniture', layer: 'Furniture' },
  decorations: { categoryId: 'furniture', layer: 'Furniture' },
  light: { categoryId: 'furniture', layer: 'Furniture' },
}

/**
 * Default category for structures we can't classify
 */
const DEFAULT_CATEGORY: { categoryId: string; layer: LayerId } = {
  categoryId: 'other',
  layer: 'Rooms',
}

/**
 * Generate a stable ID from a wiki page title
 * e.g., "Pod Hangar" → "pod_hangar"
 */
export function generateStructureId(pageTitle: string): string {
  return pageTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * Generate a color based on structure name (deterministic)
 */
function generateColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }

  // Generate a muted color in HSL space
  const hue = Math.abs(hash % 360)
  const saturation = 40 + (Math.abs(hash >> 8) % 30) // 40-70%
  const lightness = 35 + (Math.abs(hash >> 16) % 20) // 35-55%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

/**
 * Extract footprint dimensions from wiki text
 * Looks for patterns like "2x3", "2×3", "needs a 2x3 tile", "footprint of 2x3"
 * Returns null if no high-confidence match found
 */
export function parseFootprintFromWikiText(
  wikiText: string
): { width: number; height: number } | null {
  // Common patterns in wiki text for footprint/size
  const patterns = [
    // "footprint of NxM" or "footprint is NxM"
    /footprint\s+(?:of|is)\s+(\d+)\s*[x×]\s*(\d+)/i,
    // "needs a NxM tile" or "needs NxM tiles"
    /needs\s+(?:a\s+)?(\d+)\s*[x×]\s*(\d+)\s*tile/i,
    // "needs a NxM empty square" or "needs a NxM square"
    /needs\s+(?:a\s+)?(\d+)\s*[x×]\s*(\d+)\s*(?:empty\s+)?square/i,
    // "NxM tile floor" or "NxM tiles"
    /(\d+)\s*[x×]\s*(\d+)\s*tile/i,
    // "takes up NxM" or "takes NxM"
    /takes\s+(?:up\s+)?(?:a\s+)?(\d+)\s*[x×]\s*(\d+)/i,
    // Infobox style: "|size = NxM" or "|footprint = NxM"
    /\|\s*(?:size|footprint)\s*=\s*(\d+)\s*[x×]\s*(\d+)/i,
  ]

  for (const pattern of patterns) {
    const match = wikiText.match(pattern)
    if (match) {
      const width = parseInt(match[1], 10)
      const height = parseInt(match[2], 10)
      // Sanity check: reasonable building sizes
      if (width >= 1 && width <= 20 && height >= 1 && height <= 20) {
        return { width, height }
      }
    }
  }

  return null
}

/**
 * Extract category from wiki text
 * Looks for infobox category field or wiki categories
 */
function parseCategoryFromWikiText(wikiText: string): string | null {
  // Try infobox category field
  const infoboxMatch = wikiText.match(/\|\s*category\s*=\s*([^\n|]+)/i)
  if (infoboxMatch) {
    return infoboxMatch[1].trim()
  }

  // Try wiki category links
  const categoryMatch = wikiText.match(/\[\[Category:([^\]]+)\]\]/i)
  if (categoryMatch) {
    return categoryMatch[1].trim()
  }

  return null
}

/**
 * Determine internal category and layer from wiki category text
 */
function mapWikiCategory(
  wikiCategory: string | null,
  pageName: string
): { categoryId: string; layer: LayerId } {
  // Try to match wiki category
  if (wikiCategory) {
    const normalized = wikiCategory.toLowerCase().trim()
    if (WIKI_CATEGORY_MAP[normalized]) {
      return WIKI_CATEGORY_MAP[normalized]
    }

    // Partial match
    for (const [key, value] of Object.entries(WIKI_CATEGORY_MAP)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value
      }
    }
  }

  // Try to infer from page name
  const normalizedName = pageName.toLowerCase()
  for (const [key, value] of Object.entries(WIKI_CATEGORY_MAP)) {
    if (normalizedName.includes(key)) {
      return value
    }
  }

  return DEFAULT_CATEGORY
}

/**
 * Parse structure data from wiki page content
 */
function parseStructureFromWikiText(pageTitle: string, wikiText: string): ParsedStructureData {
  const footprint = parseFootprintFromWikiText(wikiText)
  const wikiCategory = parseCategoryFromWikiText(wikiText)
  const { categoryId } = mapWikiCategory(wikiCategory, pageTitle)

  return {
    name: pageTitle,
    footprint,
    category: categoryId,
    color: null, // Will be generated or inherited from static catalog
  }
}

/**
 * Build MediaWiki API URL for fetching category members
 */
function buildCategoryMembersUrl(category: string, continueToken?: string): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    list: 'categorymembers',
    cmtitle: category,
    cmlimit: '500',
    cmnamespace: '0', // Main namespace only (exclude talk pages, etc.)
  })

  if (continueToken) {
    params.set('cmcontinue', continueToken)
  }

  return `${WIKI_API_URL}?${params.toString()}`
}

/**
 * Build MediaWiki API URL for fetching all pages
 */
function buildAllPagesUrl(continueToken?: string): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    list: 'allpages',
    aplimit: '500',
    apnamespace: '0', // Main namespace only
  })

  if (continueToken) {
    params.set('apcontinue', continueToken)
  }

  return `${WIKI_API_URL}?${params.toString()}`
}

/**
 * Build MediaWiki API URL for fetching page content
 */
function buildPageContentUrl(titles: string[]): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    formatversion: '2',
    prop: 'revisions',
    rvprop: 'content|ids',
    rvslots: 'main',
    titles: titles.join('|'),
  })
  return `${WIKI_API_URL}?${params.toString()}`
}

/**
 * MediaWiki API response types
 */
interface WikiCategoryMember {
  pageid: number
  ns: number
  title: string
}

interface WikiCategoryResponse {
  query?: {
    categorymembers?: WikiCategoryMember[]
  }
  continue?: {
    cmcontinue?: string
  }
}

interface WikiRevision {
  revid: number
  slots?: {
    main?: {
      content?: string
    }
  }
}

interface WikiPage {
  pageid?: number
  title: string
  missing?: boolean
  revisions?: WikiRevision[]
}

interface WikiQueryResponse {
  query?: {
    pages?: WikiPage[]
  }
}

/**
 * Response type for allpages API
 */
interface WikiAllPagesResponse {
  query?: {
    allpages?: Array<{ pageid: number; ns: number; title: string }>
  }
  continue?: {
    apcontinue?: string
  }
}

/**
 * Check if a page title should be included as a structure
 */
function isStructurePage(title: string): boolean {
  const normalized = title.toLowerCase()
  return !SKIP_PAGES.has(normalized)
}

/**
 * Fetch structure page titles from multiple wiki categories
 */
async function fetchStructurePageTitlesFromCategories(): Promise<Set<string>> {
  const titles = new Set<string>()

  for (const category of STRUCTURE_CATEGORIES) {
    let continueToken: string | undefined

    do {
      const url = buildCategoryMembersUrl(category, continueToken)
      const response = await fetch(url)

      if (!response.ok) {
        console.warn(`Wiki API request failed for ${category}: ${response.status}`)
        break
      }

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        console.warn(`Wiki API returned non-JSON for ${category}`)
        break
      }

      const data: WikiCategoryResponse = await response.json()

      if (data.query?.categorymembers) {
        for (const member of data.query.categorymembers) {
          if (isStructurePage(member.title)) {
            titles.add(member.title)
          }
        }
      }

      continueToken = data.continue?.cmcontinue
    } while (continueToken)
  }

  return titles
}

/**
 * Fetch all page titles from the wiki (fallback/supplementary)
 */
async function fetchAllPageTitles(): Promise<Set<string>> {
  const titles = new Set<string>()
  let continueToken: string | undefined

  do {
    const url = buildAllPagesUrl(continueToken)
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Wiki API request failed: ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      throw new Error('Wiki API returned non-JSON response (possible bot challenge)')
    }

    const data: WikiAllPagesResponse = await response.json()

    if (data.query?.allpages) {
      for (const page of data.query.allpages) {
        if (isStructurePage(page.title)) {
          titles.add(page.title)
        }
      }
    }

    continueToken = data.continue?.apcontinue
  } while (continueToken)

  return titles
}

/**
 * Fetch all structure page titles from the wiki
 * Uses categories first, then supplements with allpages for comprehensive coverage
 */
async function fetchStructurePageTitles(): Promise<string[]> {
  // First, get pages from known structure categories
  const categoryTitles = await fetchStructurePageTitlesFromCategories()

  // Then, get all pages and filter to likely structures
  const allTitles = await fetchAllPageTitles()

  // Merge both sets
  const merged = new Set([...categoryTitles, ...allTitles])

  return Array.from(merged)
}

/**
 * Fetch wiki pages in batches (MediaWiki limits to 50 titles per request)
 */
async function fetchWikiPages(
  titles: string[]
): Promise<Map<string, { content: string; revisionId: number }>> {
  const results = new Map<string, { content: string; revisionId: number }>()
  const BATCH_SIZE = 50

  for (let i = 0; i < titles.length; i += BATCH_SIZE) {
    const batch = titles.slice(i, i + BATCH_SIZE)
    const url = buildPageContentUrl(batch)

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Wiki API request failed: ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      throw new Error('Wiki API returned non-JSON response (possible bot challenge)')
    }

    const data: WikiQueryResponse = await response.json()
    const pages = data.query?.pages

    if (!pages) {
      continue
    }

    for (const page of pages) {
      if (page.missing) continue

      const revision = page.revisions?.[0]
      const content = revision?.slots?.main?.content
      const revisionId = revision?.revid

      if (content && revisionId) {
        results.set(page.title, { content, revisionId })
      }
    }
  }

  return results
}

/**
 * Build a structure ID to static catalog data map for fallback/merging
 */
function buildStaticCatalogMap(): Map<
  string,
  { structure: StructureDef; category: StructureCategory }
> {
  const map = new Map<string, { structure: StructureDef; category: StructureCategory }>()

  for (const category of STATIC_CATALOG.categories) {
    for (const structure of category.items) {
      map.set(structure.id, { structure, category })
    }
  }

  return map
}

/**
 * Try to find a matching static structure by name similarity
 */
function findStaticStructureByName(
  name: string,
  staticMap: Map<string, { structure: StructureDef; category: StructureCategory }>
): { structure: StructureDef; category: StructureCategory } | null {
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '')

  for (const [id, data] of staticMap) {
    const normalizedId = id.replace(/_/g, '')
    const normalizedStructName = data.structure.name.toLowerCase().replace(/[^a-z0-9]/g, '')

    if (normalizedName === normalizedId || normalizedName === normalizedStructName) {
      return data
    }

    // Partial match for variants (e.g., "X1 Power Generator" matches "power_gen_x1")
    if (normalizedName.includes(normalizedId) || normalizedId.includes(normalizedName)) {
      return data
    }
  }

  return null
}

/**
 * Build the catalog by merging wiki data with static catalog
 * Static structures without wiki pages are preserved
 */
function buildCatalogFromWikiData(
  wikiData: Map<string, { content: string; revisionId: number }>
): StructureCatalog {
  const staticMap = buildStaticCatalogMap()

  // Track which static structures have been matched to wiki pages
  const matchedStaticIds = new Set<string>()

  // Group structures by category
  const categoryStructures = new Map<string, StructureDef[]>()

  // Initialize with static catalog categories
  for (const category of STATIC_CATALOG.categories) {
    categoryStructures.set(category.id, [])
  }
  // Add "other" category for uncategorized structures
  categoryStructures.set('other', [])

  // Process each wiki page
  for (const [pageTitle, { content }] of wikiData) {
    const parsed = parseStructureFromWikiText(pageTitle, content)
    const structureId = generateStructureId(pageTitle)

    // Try to find matching static structure for fallback data
    const staticMatch = findStaticStructureByName(pageTitle, staticMap)

    // Mark static structure as matched
    if (staticMatch) {
      matchedStaticIds.add(staticMatch.structure.id)
    }

    // Determine size: prefer wiki data, fall back to static, then default
    let size: Size
    if (parsed.footprint) {
      size = [parsed.footprint.width, parsed.footprint.height]
    } else if (staticMatch) {
      size = staticMatch.structure.size
    } else {
      size = [2, 2] // Default size for unknown structures
    }

    // Determine color: prefer static match, then generate
    const color = staticMatch?.structure.color ?? generateColor(pageTitle)

    // Determine category
    const categoryId = parsed.category ?? staticMatch?.category.id ?? 'other'

    const structure: StructureDef = {
      id: structureId,
      name: pageTitle,
      size,
      color,
      categoryId,
    }

    // Add to category
    const categoryList = categoryStructures.get(categoryId)
    if (categoryList) {
      categoryList.push(structure)
    } else {
      categoryStructures.get('other')!.push(structure)
    }
  }

  // Add static structures that don't have wiki pages
  // This ensures hull, walls, doors, windows, etc. are still available
  for (const [staticId, { structure, category }] of staticMap) {
    if (!matchedStaticIds.has(staticId)) {
      const categoryList = categoryStructures.get(category.id)
      if (categoryList) {
        categoryList.push(structure)
      }
    }
  }

  // Build final categories array
  const categories: StructureCategory[] = []

  // Add existing categories from static catalog (preserves order and metadata)
  for (const staticCategory of STATIC_CATALOG.categories) {
    const structures = categoryStructures.get(staticCategory.id) ?? []
    if (structures.length > 0) {
      categories.push({
        ...staticCategory,
        items: structures.sort((a, b) => a.name.localeCompare(b.name)),
      })
    }
  }

  // Add "Other" category if it has items
  const otherStructures = categoryStructures.get('other') ?? []
  if (otherStructures.length > 0) {
    categories.push({
      id: 'other',
      name: 'Other',
      color: '#888888',
      defaultLayer: 'Rooms',
      items: otherStructures.sort((a, b) => a.name.localeCompare(b.name)),
    })
  }

  return { categories }
}

/**
 * Compute revision key from wiki page revisions
 */
function computeRevisionKey(
  wikiData: Map<string, { content: string; revisionId: number }>
): string {
  const revisionIds = Array.from(wikiData.values())
    .map((d) => d.revisionId)
    .sort((a, b) => a - b)

  // Create a hash-like key from sorted revision IDs
  return revisionIds.join('-')
}

/**
 * Fetch structure catalog from the Space Haven wiki
 * Discovers structures dynamically from Category:Facilities
 */
export async function fetchWikiCatalog(): Promise<WikiFetchResult> {
  // Step 1: Discover all structure page titles from the wiki category
  const pageTitles = await fetchStructurePageTitles()

  if (pageTitles.length === 0) {
    throw new Error('No structure pages found in wiki category')
  }

  // Step 2: Fetch content for all pages
  const wikiData = await fetchWikiPages(pageTitles)

  if (wikiData.size === 0) {
    throw new Error('No wiki pages could be fetched')
  }

  // Step 3: Build catalog from wiki data
  const catalog = buildCatalogFromWikiData(wikiData)

  // Step 4: Compute revision key for cache validation
  const revisionKey = computeRevisionKey(wikiData)

  return { catalog, revisionKey }
}

/**
 * Get the list of unique wiki page titles that would be fetched
 * Useful for testing/debugging
 */
export function getWikiPageTitles(): string[] {
  // This is now dynamic - return empty array as we discover at runtime
  return []
}
