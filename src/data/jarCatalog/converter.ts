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
import type {
  ParsedJarData,
  RawJarStructure,
  RawJarCategory,
  RawJarTile,
  RawJarLinkedTile,
  RawJarRestriction,
} from './types'
import { MANUAL_HULL_STRUCTURES, HULL_CATEGORY } from './hullStructures'

/**
 * Mapping of JAR category IDs to our internal category metadata
 * Based on JAR SubCat IDs (under MainCat 1512 = OBJECTS)
 * Order values from JAR determine UI display order
 */
const JAR_CATEGORY_MAP: Record<
  number,
  { id: string; name: string; color: string; defaultLayer: LayerId; order: number }
> = {
  // order=1: WALL (doors, windows, walls)
  1522: { id: 'wall', name: 'Wall', color: '#3a4a5c', defaultLayer: 'Hull', order: 1 },
  // order=2: FURNITURE
  1506: {
    id: 'furniture',
    name: 'Furniture',
    color: '#aa8877',
    defaultLayer: 'Furniture',
    order: 2,
  },
  // order=2: DECORATIONS
  3359: {
    id: 'decorations',
    name: 'Decorations',
    color: '#aa7788',
    defaultLayer: 'Furniture',
    order: 2,
  },
  // order=3: FACILITY
  1507: { id: 'facility', name: 'Facility', color: '#6688aa', defaultLayer: 'Rooms', order: 3 },
  // order=4: LIFE SUPPORT
  1508: {
    id: 'life_support',
    name: 'Life Support',
    color: '#44aa88',
    defaultLayer: 'Systems',
    order: 4,
  },
  // order=5: POWER
  1516: { id: 'power', name: 'Power', color: '#cc8844', defaultLayer: 'Systems', order: 5 },
  // order=6: RESOURCE
  1510: { id: 'resource', name: 'Resource', color: '#aa8844', defaultLayer: 'Rooms', order: 6 },
  // order=7: FOOD
  1515: { id: 'food', name: 'Food', color: '#66aa44', defaultLayer: 'Rooms', order: 7 },
  // order=8: STORAGE
  1517: { id: 'storage', name: 'Storage', color: '#888866', defaultLayer: 'Rooms', order: 8 },
  // order=9: AIRLOCK
  1521: { id: 'airlock', name: 'Airlock', color: '#8866aa', defaultLayer: 'Rooms', order: 9 },
  // order=10: SYSTEM
  1519: { id: 'system', name: 'System', color: '#cc4444', defaultLayer: 'Systems', order: 10 },
  // order=10: ROBOTS
  2880: { id: 'robots', name: 'Robots', color: '#55aaaa', defaultLayer: 'Systems', order: 10 },
  // order=13: WEAPON (not typically used for ship building)
  1520: { id: 'weapon', name: 'Weapon', color: '#cc4466', defaultLayer: 'Systems', order: 13 },
  // order=20: MISSION (mission-specific items)
  4243: { id: 'mission', name: 'Mission', color: '#aa66cc', defaultLayer: 'Systems', order: 20 },
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
 * MainCat ID for OBJECTS (normal build menu)
 * Only structures from this MainCat should appear in the planner
 */
const OBJECTS_MAINCAT_ID = 1512

/**
 * Convert parsed JAR data to StructureCatalog
 */
export function convertToStructureCatalog(jarData: ParsedJarData): StructureCatalog {
  const { structures, texts, categories: jarCategories } = jarData

  // Build set of SubCat IDs that belong to OBJECTS MainCat (1512)
  const objectsSubCatIds = new Set<number>()
  for (const cat of jarCategories) {
    if (cat.parentId === OBJECTS_MAINCAT_ID) {
      objectsSubCatIds.add(cat.id)
    }
  }

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

  // Process each structure - only include those from OBJECTS MainCat (1512)
  for (const rawStruct of structures) {
    // Skip structures not in the OBJECTS build menu
    if (rawStruct.subCatId === null || !objectsSubCatIds.has(rawStruct.subCatId)) {
      continue
    }

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

  // Add manual wall structures if any (for backwards compatibility)
  // Most wall structures are now extracted from JAR subCat 1522
  const wallSeen = seenInCategory.get('wall') || new Set()
  const wallList = categoryStructures.get('wall') || []

  for (const wallStruct of MANUAL_HULL_STRUCTURES) {
    const dedupeKey = getDedupeKey(wallStruct.name, wallStruct.size)
    if (!wallSeen.has(dedupeKey)) {
      wallSeen.add(dedupeKey)
      wallList.push(wallStruct)
    }
  }

  // Ensure wall category exists
  if (!categoryStructures.has('wall')) {
    categoryStructures.set('wall', wallList)
  }

  // Build final categories array
  const resultCategories: StructureCategory[] = []

  // Category order based on JAR order attribute (game displays in DESCENDING order)
  // Screenshot shows: SYSTEM, AIRLOCK, STORAGE, FOOD, RESOURCE, POWER, LIFE SUPPORT, FACILITY, DECORATIONS, FURNITURE, WALL
  const categoryOrder = [
    'mission', // order=20
    'weapon', // order=13
    'system', // order=10
    'robots', // order=10
    'airlock', // order=9
    'storage', // order=8
    'food', // order=7
    'resource', // order=6
    'power', // order=5
    'life_support', // order=4
    'facility', // order=3
    'decorations', // order=2
    'furniture', // order=2
    'wall', // order=1
    'other', // fallback (should be empty if all categories are mapped)
  ]

  for (const catId of categoryOrder) {
    const items = categoryStructures.get(catId)
    if (!items || items.length === 0) continue

    // Find category metadata - use HULL_CATEGORY for hull
    let catMeta
    if (catId === 'wall') {
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
    // First, try direct mapping from known JAR category IDs
    const directMapping = JAR_CATEGORY_MAP[jarCat.id]
    if (directMapping) {
      lookup.set(jarCat.id, directMapping.id)
      continue
    }

    // Fallback: try to infer from category name (for unknown categories)
    const catName = texts.get(jarCat.nameTid)?.toLowerCase() || ''

    if (catName.includes('wall') || catName.includes('door') || catName.includes('window')) {
      lookup.set(jarCat.id, 'wall')
    } else if (catName.includes('decoration')) {
      lookup.set(jarCat.id, 'decorations')
    } else if (catName.includes('furniture')) {
      lookup.set(jarCat.id, 'furniture')
    } else if (
      catName.includes('facility') ||
      catName.includes('crew') ||
      catName.includes('bed') ||
      catName.includes('medical')
    ) {
      lookup.set(jarCat.id, 'facility')
    } else if (
      catName.includes('life support') ||
      catName.includes('oxygen') ||
      catName.includes('thermal')
    ) {
      lookup.set(jarCat.id, 'life_support')
    } else if (
      catName.includes('power') ||
      catName.includes('generator') ||
      catName.includes('energy')
    ) {
      lookup.set(jarCat.id, 'power')
    } else if (
      catName.includes('resource') ||
      catName.includes('refinery') ||
      catName.includes('assembler') ||
      catName.includes('industry')
    ) {
      lookup.set(jarCat.id, 'resource')
    } else if (
      catName.includes('food') ||
      catName.includes('kitchen') ||
      catName.includes('grow') ||
      catName.includes('agriculture')
    ) {
      lookup.set(jarCat.id, 'food')
    } else if (catName.includes('storage') || catName.includes('cargo')) {
      lookup.set(jarCat.id, 'storage')
    } else if (catName.includes('airlock') || catName.includes('hangar')) {
      lookup.set(jarCat.id, 'airlock')
    } else if (catName.includes('system')) {
      lookup.set(jarCat.id, 'system')
    } else if (catName.includes('robot')) {
      lookup.set(jarCat.id, 'robots')
    } else if (
      catName.includes('weapon') ||
      catName.includes('shield') ||
      catName.includes('combat')
    ) {
      lookup.set(jarCat.id, 'weapon')
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
  const size: Size = raw.size ? [raw.size.width, raw.size.height] : DEFAULT_SIZE

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

  // Step 4: Fill in gaps in the core structure area
  // This ensures structures like airlocks have a solid rectangular floor area
  // instead of scattered individual tiles
  for (let x = coreMinX; x <= coreMaxX; x++) {
    for (let y = coreMinY; y <= coreMaxY; y++) {
      const key = `${x},${y}`
      if (!tileMap.has(key)) {
        // Fill gap with construction tile (part of the structure)
        tileMap.set(key, { x, y, type: 'construction', walkCost: 1 })
        dataTileKeys.add(key) // Mark as part of the structure
      }
    }
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
