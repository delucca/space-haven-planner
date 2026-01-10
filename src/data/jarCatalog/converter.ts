/**
 * Converts parsed JAR data into StructureCatalog format
 */

import type {
  StructureCatalog,
  StructureCategory,
  StructureDef,
  LayerId,
  Size,
  TileLayout,
  StructureTile,
} from '@/data/types'
import type { ParsedJarData, RawJarStructure, RawJarCategory, RawJarTile, RawJarLinkedTile, RawJarRestriction } from './types'
import { MANUAL_HULL_STRUCTURES, HULL_CATEGORY } from './hullStructures'

/**
 * Mapping of JAR category IDs to our internal category metadata
 * This maps known Space Haven category IDs to our UI categories
 */
const JAR_CATEGORY_MAP: Record<
  number,
  { id: string; name: string; color: string; defaultLayer: LayerId }
> = {
  // Hull & Structure
  1520: { id: 'hull', name: 'Hull & Walls', color: '#3a4a5c', defaultLayer: 'Hull' },

  // Power
  1521: { id: 'power', name: 'Power', color: '#cc8844', defaultLayer: 'Systems' },

  // Life Support
  1522: { id: 'life_support', name: 'Life Support', color: '#44aa88', defaultLayer: 'Systems' },

  // Systems & Combat
  1523: { id: 'system', name: 'Systems & Combat', color: '#cc4444', defaultLayer: 'Systems' },

  // Airlock & Hangar
  1524: { id: 'airlock', name: 'Airlock & Hangar', color: '#8866aa', defaultLayer: 'Rooms' },

  // Storage
  1525: { id: 'storage', name: 'Storage', color: '#888866', defaultLayer: 'Rooms' },

  // Food & Agriculture
  1526: { id: 'food', name: 'Food & Agriculture', color: '#66aa44', defaultLayer: 'Rooms' },

  // Resource & Industry
  1527: { id: 'resource', name: 'Resource & Industry', color: '#aa8844', defaultLayer: 'Rooms' },

  // Crew Facilities
  1528: { id: 'facility', name: 'Crew Facilities', color: '#6688aa', defaultLayer: 'Rooms' },

  // Robots
  1529: { id: 'robots', name: 'Robots', color: '#55aaaa', defaultLayer: 'Systems' },

  // Furniture & Decoration
  1530: { id: 'furniture', name: 'Furniture & Decoration', color: '#aa8877', defaultLayer: 'Furniture' },
}

/**
 * Default category for structures without a known category
 */
const DEFAULT_CATEGORY = {
  id: 'other',
  name: 'Other',
  color: '#888888',
  defaultLayer: 'Rooms' as LayerId,
}

/**
 * Default structure size when not determinable from JAR
 */
const DEFAULT_SIZE: Size = [2, 2]

/**
 * Generate a deterministic color from a string (structure name)
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
 * Generate structure ID from mid
 */
export function generateStructureId(mid: number): string {
  return `mid_${mid}`
}

/**
 * Generate a deduplication key for a structure (name + size)
 * Structures with the same name and size are considered duplicates (e.g., color variants)
 */
function getDedupeKey(name: string, size: Size): string {
  return `${name}|${size[0]}x${size[1]}`
}

/**
 * Convert parsed JAR data to StructureCatalog
 */
export function convertToStructureCatalog(jarData: ParsedJarData): StructureCatalog {
  const { structures, texts, categories: jarCategories } = jarData

  // Build category lookup from JAR data
  const categoryLookup = buildCategoryLookup(jarCategories, texts)

  // Group structures by category, deduplicating by name+size within each category
  const categoryStructures = new Map<string, StructureDef[]>()
  const seenInCategory = new Map<string, Set<string>>() // categoryId -> Set of dedupeKeys

  // Initialize all known categories
  for (const catMeta of Object.values(JAR_CATEGORY_MAP)) {
    categoryStructures.set(catMeta.id, [])
    seenInCategory.set(catMeta.id, new Set())
  }
  categoryStructures.set(DEFAULT_CATEGORY.id, [])
  seenInCategory.set(DEFAULT_CATEGORY.id, new Set())

  // Process each structure
  for (const rawStruct of structures) {
    const structureDef = convertStructure(rawStruct, texts, categoryLookup)
    if (structureDef) {
      const categoryId = structureDef.categoryId
      const dedupeKey = getDedupeKey(structureDef.name, structureDef.size)
      
      // Check if we've already seen this name+size in this category
      const seen = seenInCategory.get(categoryId) || seenInCategory.get(DEFAULT_CATEGORY.id)!
      if (seen.has(dedupeKey)) {
        // Skip duplicate
        continue
      }
      
      seen.add(dedupeKey)
      const list = categoryStructures.get(categoryId)
      if (list) {
        list.push(structureDef)
      } else {
        categoryStructures.get(DEFAULT_CATEGORY.id)!.push(structureDef)
        seenInCategory.get(DEFAULT_CATEGORY.id)!.add(dedupeKey)
      }
    }
  }

  // Add manual hull structures (walls, doors, windows)
  // These aren't in the JAR build menu but are needed for ship building
  const hullSeen = seenInCategory.get('hull') || new Set()
  const hullList = categoryStructures.get('hull') || []
  
  for (const hullStruct of MANUAL_HULL_STRUCTURES) {
    const dedupeKey = getDedupeKey(hullStruct.name, hullStruct.size)
    if (!hullSeen.has(dedupeKey)) {
      hullSeen.add(dedupeKey)
      hullList.push(hullStruct)
    }
  }
  
  // Ensure hull category exists
  if (!categoryStructures.has('hull')) {
    categoryStructures.set('hull', hullList)
  }

  // Build final categories array
  const resultCategories: StructureCategory[] = []

  // Add categories in a defined order
  const categoryOrder = [
    'hull',
    'power',
    'life_support',
    'system',
    'airlock',
    'storage',
    'food',
    'resource',
    'facility',
    'robots',
    'furniture',
    'other',
  ]

  for (const catId of categoryOrder) {
    const items = categoryStructures.get(catId)
    if (!items || items.length === 0) continue

    // Find category metadata - use HULL_CATEGORY for hull
    let catMeta
    if (catId === 'hull') {
      catMeta = HULL_CATEGORY
    } else {
      catMeta =
        Object.values(JAR_CATEGORY_MAP).find((c) => c.id === catId) ||
        (catId === 'other' ? DEFAULT_CATEGORY : null)
    }

    if (catMeta) {
      resultCategories.push({
        id: catMeta.id,
        name: catMeta.name,
        color: catMeta.color,
        defaultLayer: catMeta.defaultLayer,
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      })
    }
  }

  return { categories: resultCategories }
}

/**
 * Build a lookup from JAR category IDs to our category IDs
 */
function buildCategoryLookup(
  jarCategories: readonly RawJarCategory[],
  texts: ReadonlyMap<number, string>
): Map<number, string> {
  const lookup = new Map<number, string>()

  for (const jarCat of jarCategories) {
    // First, try direct mapping
    const directMapping = JAR_CATEGORY_MAP[jarCat.id]
    if (directMapping) {
      lookup.set(jarCat.id, directMapping.id)
      continue
    }

    // Try to infer from category name
    const catName = texts.get(jarCat.nameTid)?.toLowerCase() || ''

    if (catName.includes('hull') || catName.includes('wall') || catName.includes('door')) {
      lookup.set(jarCat.id, 'hull')
    } else if (catName.includes('power') || catName.includes('generator') || catName.includes('energy')) {
      lookup.set(jarCat.id, 'power')
    } else if (catName.includes('life support') || catName.includes('oxygen') || catName.includes('thermal')) {
      lookup.set(jarCat.id, 'life_support')
    } else if (catName.includes('weapon') || catName.includes('shield') || catName.includes('combat') || catName.includes('system')) {
      lookup.set(jarCat.id, 'system')
    } else if (catName.includes('airlock') || catName.includes('hangar')) {
      lookup.set(jarCat.id, 'airlock')
    } else if (catName.includes('storage') || catName.includes('cargo')) {
      lookup.set(jarCat.id, 'storage')
    } else if (catName.includes('food') || catName.includes('kitchen') || catName.includes('grow') || catName.includes('agriculture')) {
      lookup.set(jarCat.id, 'food')
    } else if (catName.includes('resource') || catName.includes('refinery') || catName.includes('assembler') || catName.includes('industry')) {
      lookup.set(jarCat.id, 'resource')
    } else if (catName.includes('crew') || catName.includes('bed') || catName.includes('medical') || catName.includes('facility')) {
      lookup.set(jarCat.id, 'facility')
    } else if (catName.includes('robot')) {
      lookup.set(jarCat.id, 'robots')
    } else if (catName.includes('furniture') || catName.includes('decoration') || catName.includes('light')) {
      lookup.set(jarCat.id, 'furniture')
    } else {
      lookup.set(jarCat.id, 'other')
    }
  }

  return lookup
}

/**
 * Convert a single raw structure to StructureDef
 */
function convertStructure(
  raw: RawJarStructure,
  texts: ReadonlyMap<number, string>,
  categoryLookup: Map<number, string>
): StructureDef | null {
  // Get name from texts
  const name = texts.get(raw.nameTid)
  if (!name) {
    // Skip structures without names
    return null
  }

  // Determine category - check direct mapping first, then lookup, then default
  let categoryId = DEFAULT_CATEGORY.id
  if (raw.subCatId !== null) {
    // First check direct mapping from JAR_CATEGORY_MAP
    const directMapping = JAR_CATEGORY_MAP[raw.subCatId]
    if (directMapping) {
      categoryId = directMapping.id
    } else {
      // Fall back to dynamic lookup
      categoryId = categoryLookup.get(raw.subCatId) || DEFAULT_CATEGORY.id
    }
  }

  // Determine size
  const size: Size = raw.size
    ? [raw.size.width, raw.size.height]
    : DEFAULT_SIZE

  // Generate color from name
  const color = generateColor(name)

  // Convert tile layout if available
  const tileLayout = convertTileLayout(raw.tiles, raw.linkedTiles, raw.restrictions, size)

  const structureDef: StructureDef = {
    id: generateStructureId(raw.mid),
    name,
    size,
    color,
    categoryId,
  }

  // Only include tileLayout if we have meaningful tile data
  if (tileLayout && tileLayout.tiles.length > 0) {
    return { ...structureDef, tileLayout }
  }

  return structureDef
}

/**
 * Convert raw JAR tile data, linked elements, and restrictions to TileLayout
 *
 * Priority for construction tiles:
 * 1. Linked tiles (<linked>) - define the actual structure footprint
 * 2. Data tiles (<data>) - detailed tile info with walkGridCost
 *
 * Restrictions define access/blocked areas around the structure
 */
function convertTileLayout(
  rawTiles: readonly RawJarTile[],
  linkedTiles: readonly RawJarLinkedTile[],
  restrictions: readonly RawJarRestriction[],
  fallbackSize: Size
): TileLayout | undefined {
  const tileMap = new Map<string, StructureTile>()
  // Track which tiles came from data section (actual structure) vs restrictions (space requirements)
  const dataTileKeys = new Set<string>()

  // Step 1: Process linked tiles as construction tiles (primary source)
  // These define the actual structure footprint
  for (const linked of linkedTiles) {
    const key = `${linked.gridOffX},${linked.gridOffY}`
    // Linked tiles are always construction tiles (the structure itself)
    tileMap.set(key, {
      x: linked.gridOffX,
      y: linked.gridOffY,
      type: 'construction',
      walkCost: 1, // Default walkable cost for construction
    })
    dataTileKeys.add(key)
  }

  // Step 2: Process raw tiles from <data> section
  // These are actual structure elements (Door, Hull, FloorDeco, etc.)
  // Even blocked tiles from data section are part of the structure (e.g., Hull walls)
  for (const rawTile of rawTiles) {
    const key = `${rawTile.gridOffX},${rawTile.gridOffY}`
    dataTileKeys.add(key)

    const existing = tileMap.get(key)
    if (existing) {
      // Update existing tile with more specific info from data section
      // Keep construction type but mark as blocked if walkCost is high
      if (rawTile.walkGridCost >= 255) {
        tileMap.set(key, {
          x: rawTile.gridOffX,
          y: rawTile.gridOffY,
          type: 'blocked',
          walkCost: rawTile.walkGridCost,
        })
      }
    } else {
      // Add new tile from data section
      // Determine tile type based on walkGridCost and element type:
      // - walkGridCost >= 255: blocked (can't walk)
      // - FloorDeco, Light: access (decorative floor, crew can walk)
      // - Others with walkGridCost < 255: construction (actual structure)
      let tileType: 'construction' | 'blocked' | 'access'
      if (rawTile.walkGridCost >= 255) {
        tileType = 'blocked'
      } else if (rawTile.elementType === 'FloorDeco' || rawTile.elementType === 'Light') {
        tileType = 'access'
      } else {
        tileType = 'construction'
      }
      tileMap.set(key, {
        x: rawTile.gridOffX,
        y: rawTile.gridOffY,
        type: tileType,
        walkCost: rawTile.walkGridCost,
      })
    }
  }

  // Calculate bounding box of data tiles first (needed for Space restriction filtering)
  let dataMinX = Infinity,
    dataMaxX = -Infinity,
    dataMinY = Infinity,
    dataMaxY = -Infinity
  for (const key of dataTileKeys) {
    const [xStr, yStr] = key.split(',')
    const x = parseInt(xStr, 10)
    const y = parseInt(yStr, 10)
    dataMinX = Math.min(dataMinX, x)
    dataMaxX = Math.max(dataMaxX, x)
    dataMinY = Math.min(dataMinY, y)
    dataMaxY = Math.max(dataMaxY, y)
  }

  // Step 3: Process restrictions to add access/blocked tiles around the structure
  for (const restriction of restrictions) {
    if (restriction.type === 'Floor') {
      // Floor restrictions indicate tiles that need floor beneath them
      // These are typically access tiles where crew can walk/work
      for (let dx = 0; dx < restriction.sizeX; dx++) {
        for (let dy = 0; dy < restriction.sizeY; dy++) {
          const x = restriction.gridX + dx
          const y = restriction.gridY + dy
          const key = `${x},${y}`

          // Only add if not already defined by structure tiles
          if (!tileMap.has(key)) {
            tileMap.set(key, {
              x,
              y,
              type: 'access',
              walkCost: 0, // Floor restrictions are walkable
            })
          }
        }
      }
    } else if (restriction.type === 'Space' || restriction.type === 'SpaceOneOnly') {
      // Space restrictions define where space must be (outside airlocks, cargo ports, etc.)
      // Include ALL space tiles - they represent the blocked area extending into space
      for (let dx = 0; dx < restriction.sizeX; dx++) {
        for (let dy = 0; dy < restriction.sizeY; dy++) {
          const x = restriction.gridX + dx
          const y = restriction.gridY + dy
          const key = `${x},${y}`

          if (!tileMap.has(key)) {
            tileMap.set(key, {
              x,
              y,
              type: 'blocked',
              walkCost: 255,
            })
          }
        }
      }
    }
  }

  // If no tiles found, return undefined
  if (tileMap.size === 0) {
    return undefined
  }

  // Calculate the bounding box of actual structure tiles (from data + linked, not restrictions)
  let coreMinX = Infinity,
    coreMaxX = -Infinity,
    coreMinY = Infinity,
    coreMaxY = -Infinity
  let hasCoreTiles = false

  for (const tile of tileMap.values()) {
    const key = `${tile.x},${tile.y}`
    // Only consider tiles that came from data/linked sections as "core"
    if (dataTileKeys.has(key)) {
      coreMinX = Math.min(coreMinX, tile.x)
      coreMaxX = Math.max(coreMaxX, tile.x)
      coreMinY = Math.min(coreMinY, tile.y)
      coreMaxY = Math.max(coreMaxY, tile.y)
      hasCoreTiles = true
    }
  }

  // If no core tiles, use fallback size centered at origin
  if (!hasCoreTiles) {
    coreMinX = 0
    coreMaxX = fallbackSize[0] - 1
    coreMinY = 0
    coreMaxY = fallbackSize[1] - 1
  }

  // Filter tiles:
  // - All tiles from data/linked sections are included (they ARE the structure)
  // - Access tiles from Floor restrictions: included if within 1 tile of core
  // - Blocked tiles from Space restrictions: ALL included (they define space area for airlocks/cargo ports)
  const ACCESS_MARGIN = 1
  const filteredTiles: StructureTile[] = []

  for (const tile of tileMap.values()) {
    const key = `${tile.x},${tile.y}`

    if (dataTileKeys.has(key)) {
      // Tiles from data/linked sections are always included
      filteredTiles.push(tile)
    } else if (tile.type === 'blocked') {
      // Blocked tiles from Space restrictions are always included
      // They define the space area for airlocks/cargo ports
      filteredTiles.push(tile)
    } else if (tile.type === 'access') {
      // Access tiles from Floor restrictions: allow within 1 tile margin of core
      const isNearCore =
        tile.x >= coreMinX - ACCESS_MARGIN &&
        tile.x <= coreMaxX + ACCESS_MARGIN &&
        tile.y >= coreMinY - ACCESS_MARGIN &&
        tile.y <= coreMaxY + ACCESS_MARGIN

      if (isNearCore) {
        filteredTiles.push(tile)
      }
    }
  }

  if (filteredTiles.length === 0) {
    return undefined
  }

  // Calculate final bounding box from filtered tiles
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity

  for (const tile of filteredTiles) {
    minX = Math.min(minX, tile.x)
    maxX = Math.max(maxX, tile.x)
    minY = Math.min(minY, tile.y)
    maxY = Math.max(maxY, tile.y)
  }

  // If we have tiles, calculate actual dimensions
  const width = filteredTiles.length > 0 ? maxX - minX + 1 : fallbackSize[0]
  const height = filteredTiles.length > 0 ? maxY - minY + 1 : fallbackSize[1]

  // IMPORTANT: Normalize tile coordinates to start at (0,0)
  // This is required for rotation to work correctly
  const normalizedTiles: StructureTile[] = filteredTiles.map((tile) => ({
    ...tile,
    x: tile.x - minX,
    y: tile.y - minY,
  }))

  return {
    tiles: normalizedTiles,
    width,
    height,
  }
}

/**
 * Merge a JAR catalog with a static fallback catalog
 * JAR data takes precedence, but static data fills gaps
 */
export function mergeCatalogs(
  jarCatalog: StructureCatalog,
  staticCatalog: StructureCatalog
): StructureCatalog {
  // Build a set of structure IDs from JAR catalog
  const jarStructureIds = new Set<string>()
  for (const cat of jarCatalog.categories) {
    for (const item of cat.items) {
      jarStructureIds.add(item.id)
    }
  }

  // Build a map of categories from JAR catalog
  const categoryMap = new Map<string, StructureDef[]>()
  for (const cat of jarCatalog.categories) {
    categoryMap.set(cat.id, [...cat.items])
  }

  // Add static structures that don't exist in JAR catalog
  for (const staticCat of staticCatalog.categories) {
    for (const item of staticCat.items) {
      if (!jarStructureIds.has(item.id)) {
        const list = categoryMap.get(staticCat.id)
        if (list) {
          list.push(item)
        } else {
          categoryMap.set(staticCat.id, [item])
        }
      }
    }
  }

  // Rebuild categories
  const resultCategories: StructureCategory[] = []

  // Use JAR categories as base, preserving metadata
  for (const jarCat of jarCatalog.categories) {
    const items = categoryMap.get(jarCat.id) || []
    if (items.length > 0) {
      resultCategories.push({
        ...jarCat,
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      })
    }
    categoryMap.delete(jarCat.id)
  }

  // Add any remaining categories from static catalog
  for (const staticCat of staticCatalog.categories) {
    const items = categoryMap.get(staticCat.id)
    if (items && items.length > 0) {
      resultCategories.push({
        ...staticCat,
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      })
    }
  }

  return { categories: resultCategories }
}

