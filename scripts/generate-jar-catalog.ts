#!/usr/bin/env npx tsx
/**
 * Generate built-in catalog snapshot from a reference spacehaven.jar
 *
 * Usage:
 *   npx tsx scripts/generate-jar-catalog.ts [path-to-spacehaven.jar]
 *
 * If no path is provided, looks for spacehaven.jar in the project root.
 *
 * Output:
 *   Overwrites src/data/jarCatalog/builtinSnapshot.ts with the generated catalog
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { unzipSync } from 'fflate'

// Types (duplicated here to avoid import issues in Node context)
interface RawJarTile {
  gridOffX: number
  gridOffY: number
  elementType: string
  walkGridCost: number
}

interface RawJarLinkedTile {
  id: number
  eid: number
  gridOffX: number
  gridOffY: number
  rot: string
}

interface RawJarRestriction {
  type: string
  gridX: number
  gridY: number
  sizeX: number
  sizeY: number
}

interface RawJarStructure {
  mid: number
  nameTid: number
  subCatId: number | null
  size: { width: number; height: number } | null
  debugName: string | null
  tiles: RawJarTile[]
  linkedTiles: RawJarLinkedTile[]
  restrictions: RawJarRestriction[]
}

interface RawJarCategory {
  id: number
  nameTid: number
  parentId: number | null
}

interface ParsedJarData {
  structures: RawJarStructure[]
  texts: Map<number, string>
  categories: RawJarCategory[]
  gameVersion: string | null
}

type TileType = 'construction' | 'blocked' | 'access'

interface StructureTile {
  x: number
  y: number
  type: TileType
  walkCost: number
}

interface TileLayout {
  tiles: StructureTile[]
  width: number
  height: number
}

// Category mapping based on JAR SubCat IDs (under MainCat 1512 = OBJECTS)
// Order values from JAR determine UI display order
const JAR_CATEGORY_MAP: Record<
  number,
  { id: string; name: string; color: string; defaultLayer: string; order: number }
> = {
  // order=1: WALL (doors, windows, walls)
  1522: { id: 'wall', name: 'Wall', color: '#3a4a5c', defaultLayer: 'Hull', order: 1 },
  // order=2: FURNITURE
  1506: { id: 'furniture', name: 'Furniture', color: '#aa8877', defaultLayer: 'Furniture', order: 2 },
  // order=2: DECORATIONS
  3359: { id: 'decorations', name: 'Decorations', color: '#aa7788', defaultLayer: 'Furniture', order: 2 },
  // order=3: FACILITY
  1507: { id: 'facility', name: 'Facility', color: '#6688aa', defaultLayer: 'Rooms', order: 3 },
  // order=4: LIFE SUPPORT
  1508: { id: 'life_support', name: 'Life Support', color: '#44aa88', defaultLayer: 'Systems', order: 4 },
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
  // NOTE: MISSION category (4243) intentionally excluded - mission-specific items not useful for ship planning
}

/**
 * Category IDs to completely exclude from the catalog
 * Structures in these categories won't appear anywhere (not even in "Other")
 */
const EXCLUDED_CATEGORY_IDS = new Set<number>([
  4243, // MISSION - mission-specific items not useful for ship planning
])

const DEFAULT_CATEGORY = {
  id: 'other',
  name: 'Other',
  color: '#888888',
  defaultLayer: 'Rooms',
}

/**
 * Get the color for a category by its ID
 */
function getCategoryColor(categoryId: string): string {
  // Check JAR_CATEGORY_MAP first
  for (const catMeta of Object.values(JAR_CATEGORY_MAP)) {
    if (catMeta.id === categoryId) {
      return catMeta.color
    }
  }
  // Fall back to default category color
  return DEFAULT_CATEGORY.color
}

function parseTextsXml(xml: string): Map<number, string> {
  const texts = new Map<number, string>()
  
  // New format: <t id="54" pid="52"><EN>Crate</EN>...</t>
  // Match <t id="...">...<EN>...</EN>...</t>
  const textBlockRegex = /<t\s+id="(\d+)"[^>]*>([\s\S]*?)<\/t>/g
  let match
  while ((match = textBlockRegex.exec(xml)) !== null) {
    const id = parseInt(match[1], 10)
    const block = match[2]
    
    // Extract English text from <EN>...</EN>
    const enMatch = block.match(/<EN>([^<]*)<\/EN>/)
    if (enMatch && !isNaN(id)) {
      texts.set(id, enMatch[1].trim())
    }
  }
  
  // Fallback: old format with EN attribute
  if (texts.size === 0) {
    const textRegex = /<t[^>]+id="(\d+)"[^>]+EN="([^"]*)"[^>]*\/?>/g
    while ((match = textRegex.exec(xml)) !== null) {
      const id = parseInt(match[1], 10)
      const en = match[2]
      if (!isNaN(id) && en) {
        texts.set(id, en)
      }
    }
    
    // Also try reverse attribute order
    const textRegex2 = /<t[^>]+EN="([^"]*)"[^>]+id="(\d+)"[^>]*\/?>/g
    while ((match = textRegex2.exec(xml)) !== null) {
      const id = parseInt(match[2], 10)
      const en = match[1]
      if (!isNaN(id) && en && !texts.has(id)) {
        texts.set(id, en)
      }
    }
  }
  
  return texts
}

function parseHavenXml(xml: string): { structures: RawJarStructure[]; categories: RawJarCategory[] } {
  const structures: RawJarStructure[] = []
  const categories: RawJarCategory[] = []
  
  // Parse categories
  const catRegex = /<cat[^>]+id="(\d+)"[^>]*>/g
  let match
  while ((match = catRegex.exec(xml)) !== null) {
    const id = parseInt(match[1], 10)
    if (!isNaN(id)) {
      // Extract category block
      const catBlock = xml.slice(match.index, xml.indexOf('</cat>', match.index) + 6)
      
      // Extract name tid
      const nameTidMatch = catBlock.match(/<name[^>]+tid="(\d+)"/)
      const nameTid = nameTidMatch ? parseInt(nameTidMatch[1], 10) : 0
      
      // Extract mainCat parent id
      const mainCatMatch = catBlock.match(/<mainCat[^>]+id="(\d+)"/)
      const parentId = mainCatMatch ? parseInt(mainCatMatch[1], 10) : null
      
      categories.push({ id, nameTid, parentId })
    }
  }
  
  // Parse structures (me elements with objectInfo)
  const meRegex = /<me[^>]+mid="(\d+)"[^>]*>/g
  while ((match = meRegex.exec(xml)) !== null) {
    const mid = parseInt(match[1], 10)
    if (isNaN(mid)) continue
    
    // Find the closing tag
    let depth = 1
    let endIndex = match.index + match[0].length
    while (depth > 0 && endIndex < xml.length) {
      const nextOpen = xml.indexOf('<me', endIndex)
      const nextClose = xml.indexOf('</me>', endIndex)
      
      if (nextClose === -1) break
      
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++
        endIndex = nextOpen + 3
      } else {
        depth--
        endIndex = nextClose + 5
      }
    }
    
    const meBlock = xml.slice(match.index, endIndex)
    
    // Check for objectInfo
    if (!meBlock.includes('<objectInfo')) continue
    
    // Extract name tid
    const nameTidMatch = meBlock.match(/<objectInfo[\s\S]*?<name[^>]+tid="(\d+)"/)
    const nameTid = nameTidMatch ? parseInt(nameTidMatch[1], 10) : 0
    if (nameTid === 0) continue
    
    // Extract subCat id
    const subCatMatch = meBlock.match(/<subCat[^>]+id="(\d+)"/)
    const subCatId = subCatMatch ? parseInt(subCatMatch[1], 10) : null
    
    // Extract debug name
    const debugNameMatch = match[0].match(/_name="([^"]*)"/)
    const debugName = debugNameMatch ? debugNameMatch[1] : null
    
    // Extract tile data from <data> section
    const tiles = parseStructureTiles(meBlock)
    
    // Extract linked tiles from <linked> section
    const linkedTiles = parseLinkedTiles(meBlock)
    
    // Extract restrictions
    const restrictions = parseStructureRestrictions(meBlock)
    
    // Calculate size from linked tiles and data tiles (not restrictions)
    const size = calculateStructureSize(tiles, linkedTiles)
    
    structures.push({ mid, nameTid, subCatId, size, debugName, tiles, linkedTiles, restrictions })
  }
  
  return { structures, categories }
}

/**
 * Parse linked elements from <linked> section
 * These define the actual construction tiles that make up the structure
 */
function parseLinkedTiles(meBlock: string): RawJarLinkedTile[] {
  const linkedTiles: RawJarLinkedTile[] = []
  
  // Find <linked> section
  const linkedMatch = meBlock.match(/<linked>([\s\S]*?)<\/linked>/)
  if (!linkedMatch) return linkedTiles
  
  const linkedBlock = linkedMatch[1]
  
  // Find all <l> elements with gridOffX and gridOffY
  // Pattern: <l id="..." eid="..." gridOffX="..." gridOffY="..." rot="..." .../>
  const linkRegex = /<l[^>]+id="(\d+)"[^>]+eid="(\d+)"[^>]+gridOffX="(-?\d+)"[^>]+gridOffY="(-?\d+)"[^>]+rot="([^"]*)"[^>]*\/?>/g
  let linkMatch
  
  while ((linkMatch = linkRegex.exec(linkedBlock)) !== null) {
    linkedTiles.push({
      id: parseInt(linkMatch[1], 10),
      eid: parseInt(linkMatch[2], 10),
      gridOffX: parseInt(linkMatch[3], 10),
      gridOffY: parseInt(linkMatch[4], 10),
      rot: linkMatch[5],
    })
  }
  
  // Also try alternate attribute orders
  const linkRegex2 = /<l[^>]+gridOffX="(-?\d+)"[^>]+gridOffY="(-?\d+)"[^>]+id="(\d+)"[^>]+eid="(\d+)"[^>]+rot="([^"]*)"[^>]*\/?>/g
  while ((linkMatch = linkRegex2.exec(linkedBlock)) !== null) {
    const gridOffX = parseInt(linkMatch[1], 10)
    const gridOffY = parseInt(linkMatch[2], 10)
    // Check if we already have this position
    const exists = linkedTiles.some(t => t.gridOffX === gridOffX && t.gridOffY === gridOffY)
    if (exists) continue
    
    linkedTiles.push({
      id: parseInt(linkMatch[3], 10),
      eid: parseInt(linkMatch[4], 10),
      gridOffX,
      gridOffY,
      rot: linkMatch[5],
    })
  }
  
  return linkedTiles
}

/**
 * Calculate structure size from tiles and linked elements
 * Linked elements take priority as they define the actual construction footprint
 */
function calculateStructureSize(
  tiles: RawJarTile[],
  linkedTiles: RawJarLinkedTile[]
): { width: number; height: number } | null {
  // Combine all tile positions
  const positions: { x: number; y: number }[] = []

  // Add positions from linked tiles (primary source for construction footprint)
  for (const linked of linkedTiles) {
    positions.push({ x: linked.gridOffX, y: linked.gridOffY })
  }

  // Add positions from data tiles
  for (const tile of tiles) {
    positions.push({ x: tile.gridOffX, y: tile.gridOffY })
  }

  if (positions.length === 0) {
    return null
  }

  // Calculate bounding box
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity

  for (const pos of positions) {
    minX = Math.min(minX, pos.x)
    maxX = Math.max(maxX, pos.x)
    minY = Math.min(minY, pos.y)
    maxY = Math.max(maxY, pos.y)
  }

  const width = maxX - minX + 1
  const height = maxY - minY + 1

  return { width, height }
}

/**
 * Parse tile data from the <data> section of a structure
 */
function parseStructureTiles(meBlock: string): RawJarTile[] {
  const tiles: RawJarTile[] = []
  
  // Find <data> section
  const dataMatch = meBlock.match(/<data>([\s\S]*?)<\/data>/)
  if (!dataMatch) return tiles
  
  const dataBlock = dataMatch[1]
  
  // Find all <l> elements with gridOffX and gridOffY
  const tileRegex = /<l[^>]+type="([^"]*)"[^>]+gridOffX="(-?\d+)"[^>]+gridOffY="(-?\d+)"[^>]*>([\s\S]*?)<\/l>/g
  let tileMatch
  
  while ((tileMatch = tileRegex.exec(dataBlock)) !== null) {
    const elementType = tileMatch[1]
    const gridOffX = parseInt(tileMatch[2], 10)
    const gridOffY = parseInt(tileMatch[3], 10)
    const innerContent = tileMatch[4]
    
    // Extract walkGridCost from <element> if present
    const walkCostMatch = innerContent.match(/walkGridCost="(\d+)"/)
    const walkGridCost = walkCostMatch ? parseInt(walkCostMatch[1], 10) : 1
    
    tiles.push({
      gridOffX,
      gridOffY,
      elementType,
      walkGridCost,
    })
  }
  
  // Also try alternate attribute order
  const tileRegex2 = /<l[^>]+gridOffX="(-?\d+)"[^>]+gridOffY="(-?\d+)"[^>]+type="([^"]*)"[^>]*>([\s\S]*?)<\/l>/g
  while ((tileMatch = tileRegex2.exec(dataBlock)) !== null) {
    const gridOffX = parseInt(tileMatch[1], 10)
    const gridOffY = parseInt(tileMatch[2], 10)
    const elementType = tileMatch[3]
    const innerContent = tileMatch[4]
    
    // Check if we already have this tile
    const exists = tiles.some(t => t.gridOffX === gridOffX && t.gridOffY === gridOffY)
    if (exists) continue
    
    const walkCostMatch = innerContent.match(/walkGridCost="(\d+)"/)
    const walkGridCost = walkCostMatch ? parseInt(walkCostMatch[1], 10) : 1
    
    tiles.push({
      gridOffX,
      gridOffY,
      elementType,
      walkGridCost,
    })
  }
  
  return tiles
}

/**
 * Parse restriction tiles from objectInfo/restrictions
 */
function parseStructureRestrictions(meBlock: string): RawJarRestriction[] {
  const restrictions: RawJarRestriction[] = []
  
  // Find <restrictions> section within <objectInfo>
  const restrictionsMatch = meBlock.match(/<restrictions>([\s\S]*?)<\/restrictions>/)
  if (!restrictionsMatch) return restrictions
  
  const restrictionsBlock = restrictionsMatch[1]
  
  // Find all <l> elements with type
  const restrictionRegex = /<l[^>]+type="([^"]*)"[^>]+gridX="(-?\d+)"[^>]+gridY="(-?\d+)"[^>]+sizeX="(\d+)"[^>]+sizeY="(\d+)"[^>]*\/?>/g
  let match
  
  while ((match = restrictionRegex.exec(restrictionsBlock)) !== null) {
    restrictions.push({
      type: match[1],
      gridX: parseInt(match[2], 10),
      gridY: parseInt(match[3], 10),
      sizeX: parseInt(match[4], 10),
      sizeY: parseInt(match[5], 10),
    })
  }
  
  return restrictions
}

function extractGameVersion(unzipped: Record<string, Uint8Array>): string | null {
  // Try to extract from haven XML libVersion attribute (most reliable)
  const havenData = unzipped['library/haven']
  if (havenData) {
    const havenXml = new TextDecoder('utf-8').decode(havenData.slice(0, 500)) // Only need start
    const versionMatch = havenXml.match(/libVersion="([^"]+)"/)
    if (versionMatch) {
      return versionMatch[1]
    }
  }

  // Try library/Version____PC____ (may contain platform info)
  const versionFile = unzipped['library/Version____PC____'] || unzipped['library/version']
  if (versionFile) {
    let content = new TextDecoder('utf-8').decode(versionFile).trim()
    // Remove XML tags if present
    content = content.replace(/<[^>]+>/g, '').trim()
    if (content && content.length < 50) {
      return content
    }
  }

  // Fallback: check manifest
  const manifestData = unzipped['META-INF/MANIFEST.MF']
  if (manifestData) {
    const content = new TextDecoder('utf-8').decode(manifestData)
    const versionMatch = content.match(/(?:version|Version)[:=\s]+([0-9.]+)/i)
    if (versionMatch) {
      return versionMatch[1]
    }
  }

  return null
}

function parseJarBytes(bytes: Uint8Array): ParsedJarData {
  const unzipped = unzipSync(bytes)
  
  const havenData = unzipped['library/haven']
  const textsData = unzipped['library/texts']
  
  if (!havenData) {
    throw new Error('JAR file is missing library/haven')
  }
  if (!textsData) {
    throw new Error('JAR file is missing library/texts')
  }
  
  const havenXml = new TextDecoder('utf-8').decode(havenData)
  const textsXml = new TextDecoder('utf-8').decode(textsData)
  
  const texts = parseTextsXml(textsXml)
  const { structures, categories } = parseHavenXml(havenXml)
  const gameVersion = extractGameVersion(unzipped)
  
  return { structures, texts, categories, gameVersion }
}

function buildCategoryLookup(
  jarCategories: RawJarCategory[],
  texts: Map<number, string>
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
    } else if (catName.includes('facility') || catName.includes('crew') || catName.includes('bed') || catName.includes('medical')) {
      lookup.set(jarCat.id, 'facility')
    } else if (catName.includes('life support') || catName.includes('oxygen') || catName.includes('thermal')) {
      lookup.set(jarCat.id, 'life_support')
    } else if (catName.includes('power') || catName.includes('generator') || catName.includes('energy')) {
      lookup.set(jarCat.id, 'power')
    } else if (catName.includes('resource') || catName.includes('refinery') || catName.includes('assembler') || catName.includes('industry')) {
      lookup.set(jarCat.id, 'resource')
    } else if (catName.includes('food') || catName.includes('kitchen') || catName.includes('grow') || catName.includes('agriculture')) {
      lookup.set(jarCat.id, 'food')
    } else if (catName.includes('storage') || catName.includes('cargo')) {
      lookup.set(jarCat.id, 'storage')
    } else if (catName.includes('airlock') || catName.includes('hangar')) {
      lookup.set(jarCat.id, 'airlock')
    } else if (catName.includes('system')) {
      lookup.set(jarCat.id, 'system')
    } else if (catName.includes('robot')) {
      lookup.set(jarCat.id, 'robots')
    } else if (catName.includes('weapon') || catName.includes('shield') || catName.includes('combat')) {
      lookup.set(jarCat.id, 'weapon')
    } else {
      lookup.set(jarCat.id, 'other')
    }
  }
  
  return lookup
}

interface StructureDef {
  id: string
  name: string
  size: [number, number]
  color: string
  categoryId: string
  tileLayout?: TileLayout
}

interface StructureCategory {
  id: string
  name: string
  color: string
  defaultLayer: string
  items: StructureDef[]
}

interface StructureCatalog {
  categories: StructureCategory[]
}

/**
 * Generate a deduplication key for a structure (name + size)
 * Structures with the same name and size are considered duplicates (e.g., color variants)
 */
function getDedupeKey(name: string, size: [number, number]): string {
  return `${name}|${size[0]}x${size[1]}`
}

/**
 * MainCat ID for OBJECTS (normal build menu)
 * Only structures from this MainCat should appear in the planner
 */
const OBJECTS_MAINCAT_ID = 1512

function convertToStructureCatalog(jarData: ParsedJarData): StructureCatalog {
  const { structures, texts, categories: jarCategories } = jarData
  
  // Build set of SubCat IDs that belong to OBJECTS MainCat (1512)
  const objectsSubCatIds = new Set<number>()
  for (const cat of jarCategories) {
    if (cat.parentId === OBJECTS_MAINCAT_ID) {
      objectsSubCatIds.add(cat.id)
    }
  }
  
  const categoryLookup = buildCategoryLookup(jarCategories, texts)
  const categoryStructures = new Map<string, StructureDef[]>()
  const seenInCategory = new Map<string, Set<string>>() // categoryId -> Set of dedupeKeys
  
  for (const catMeta of Object.values(JAR_CATEGORY_MAP)) {
    categoryStructures.set(catMeta.id, [])
    seenInCategory.set(catMeta.id, new Set())
  }
  categoryStructures.set(DEFAULT_CATEGORY.id, [])
  seenInCategory.set(DEFAULT_CATEGORY.id, new Set())
  
  for (const raw of structures) {
    // Skip structures not in the OBJECTS build menu (MainCat 1512)
    if (raw.subCatId === null || !objectsSubCatIds.has(raw.subCatId)) {
      continue
    }
    
    // Skip structures from excluded categories (e.g., mission-specific items)
    if (EXCLUDED_CATEGORY_IDS.has(raw.subCatId)) {
      continue
    }
    
    const name = texts.get(raw.nameTid)
    if (!name) continue
    
    let categoryId = DEFAULT_CATEGORY.id
    if (raw.subCatId !== null) {
      categoryId = categoryLookup.get(raw.subCatId) || DEFAULT_CATEGORY.id
    }
    
    const size: [number, number] = raw.size ? [raw.size.width, raw.size.height] : [2, 2]
    const dedupeKey = getDedupeKey(name, size)
    
    // Check if we've already seen this name+size in this category
    const seen = seenInCategory.get(categoryId) || seenInCategory.get(DEFAULT_CATEGORY.id)!
    if (seen.has(dedupeKey)) {
      // Skip duplicate
      continue
    }
    seen.add(dedupeKey)
    
    // Use category color for all items in the category
    const color = getCategoryColor(categoryId)
    
    // Convert tile layout
    const tileLayout = convertTileLayout(raw.tiles, raw.linkedTiles, raw.restrictions, size)
    
    const structureDef: StructureDef = {
      id: `mid_${raw.mid}`,
      name,
      size,
      color,
      categoryId,
    }
    
    // Only add tileLayout if we have meaningful tile data
    if (tileLayout && tileLayout.tiles.length > 0) {
      structureDef.tileLayout = tileLayout
    }
    
    const list = categoryStructures.get(categoryId)
    if (list) {
      list.push(structureDef)
    } else {
      categoryStructures.get(DEFAULT_CATEGORY.id)!.push(structureDef)
      seenInCategory.get(DEFAULT_CATEGORY.id)!.add(dedupeKey)
    }
  }
  
  const resultCategories: StructureCategory[] = []
  // Category order based on JAR order attribute (game displays in DESCENDING order)
  // Screenshot shows: SYSTEM, AIRLOCK, STORAGE, FOOD, RESOURCE, POWER, LIFE SUPPORT, FACILITY, DECORATIONS, FURNITURE, WALL
  // NOTE: 'mission' category excluded - mission-specific items not useful for ship planning
  const categoryOrder = [
    'weapon',      // order=13
    'system',      // order=10
    'robots',      // order=10
    'airlock',     // order=9
    'storage',     // order=8
    'food',        // order=7
    'resource',    // order=6
    'power',       // order=5
    'life_support',// order=4
    'facility',    // order=3
    'decorations', // order=2
    'furniture',   // order=2
    'wall',        // order=1
    'other',       // fallback (should be empty if all categories are mapped)
  ]
  
  for (const catId of categoryOrder) {
    const items = categoryStructures.get(catId)
    if (!items || items.length === 0) continue
    
    const catMeta =
      Object.values(JAR_CATEGORY_MAP).find((c) => c.id === catId) ||
      (catId === 'other' ? DEFAULT_CATEGORY : null)
    
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
 * Convert raw JAR tile data, linked elements, and restrictions to TileLayout
 *
 * Priority for construction tiles:
 * 1. Linked tiles (<linked>) - define the actual structure footprint
 * 2. Data tiles (<data>) - detailed tile info with walkGridCost
 *
 * Restrictions define access/blocked areas around the structure
 */
function convertTileLayout(
  rawTiles: RawJarTile[],
  linkedTiles: RawJarLinkedTile[],
  restrictions: RawJarRestriction[],
  fallbackSize: [number, number]
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
  let dataMinX = Infinity, dataMaxX = -Infinity, dataMinY = Infinity, dataMaxY = -Infinity
  for (const key of dataTileKeys) {
    const [x, y] = key.split(',').map(Number)
    dataMinX = Math.min(dataMinX, x)
    dataMaxX = Math.max(dataMaxX, x)
    dataMinY = Math.min(dataMinY, y)
    dataMaxY = Math.max(dataMaxY, y)
  }

  // Step 3: Process restrictions to add access/blocked tiles around the structure
  for (const restriction of restrictions) {
    if (restriction.type === 'Floor') {
      for (let dx = 0; dx < restriction.sizeX; dx++) {
        for (let dy = 0; dy < restriction.sizeY; dy++) {
          const x = restriction.gridX + dx
          const y = restriction.gridY + dy
          const key = `${x},${y}`
          // Only add if not already defined by structure tiles
          if (!tileMap.has(key)) {
            tileMap.set(key, { x, y, type: 'access', walkCost: 0 })
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
            tileMap.set(key, { x, y, type: 'blocked', walkCost: 255 })
          }
        }
      }
    }
  }

  if (tileMap.size === 0) {
    return undefined
  }

  // Calculate the bounding box of actual structure tiles (from data + linked, not restrictions)
  let coreMinX = Infinity, coreMaxX = -Infinity, coreMinY = Infinity, coreMaxY = -Infinity
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
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity

  for (const tile of filteredTiles) {
    minX = Math.min(minX, tile.x)
    maxX = Math.max(maxX, tile.x)
    minY = Math.min(minY, tile.y)
    maxY = Math.max(maxY, tile.y)
  }

  const width = filteredTiles.length > 0 ? maxX - minX + 1 : fallbackSize[0]
  const height = filteredTiles.length > 0 ? maxY - minY + 1 : fallbackSize[1]

  // IMPORTANT: Normalize tile coordinates to start at (0,0)
  // This is required for rotation to work correctly
  const normalizedTiles: StructureTile[] = filteredTiles.map((tile) => ({
    ...tile,
    x: tile.x - minX,
    y: tile.y - minY,
  }))

  return { tiles: normalizedTiles, width, height }
}

function generateSnapshotFile(
  catalog: StructureCatalog,
  sourceInfo: {
    fileName: string
    fileSize: number
    gameVersion: string | null
  }
): string {
  const now = Date.now()
  
  return `/**
 * Built-in catalog snapshot derived from a reference spacehaven.jar
 *
 * This file is auto-generated by scripts/generate-jar-catalog.ts
 * DO NOT EDIT MANUALLY
 *
 * Source: ${sourceInfo.fileName}
 * Size: ${sourceInfo.fileSize} bytes
 * Game Version: ${sourceInfo.gameVersion || 'unknown'}
 * Generated: ${new Date(now).toISOString()}
 */

import type { StructureCatalog } from '@/data/types'
import type { JarSourceInfo } from './types'

/**
 * Metadata about the source JAR used to generate this snapshot
 */
export const BUILTIN_SOURCE_INFO: JarSourceInfo = {
  fileName: ${JSON.stringify(sourceInfo.fileName)},
  fileSize: ${sourceInfo.fileSize},
  lastModified: ${now},
  extractedAt: ${now},
  gameVersion: ${JSON.stringify(sourceInfo.gameVersion)},
}

/**
 * The built-in catalog snapshot
 */
export const BUILTIN_CATALOG: StructureCatalog = ${JSON.stringify(catalog, null, 2)}

/**
 * Game version of the reference JAR
 */
export const BUILTIN_GAME_VERSION: string | null = ${JSON.stringify(sourceInfo.gameVersion)}

/**
 * Timestamp when the snapshot was generated
 */
export const BUILTIN_GENERATED_AT: number = ${now}

/**
 * Get the built-in catalog
 */
export function getBuiltinCatalog(): StructureCatalog {
  return BUILTIN_CATALOG
}

/**
 * Check if we're using a real JAR-derived snapshot vs static fallback
 */
export function hasRealJarSnapshot(): boolean {
  return true
}
`
}

async function main() {
  const args = process.argv.slice(2)
  const jarPath = args[0] || path.join(process.cwd(), 'spacehaven.jar')
  
  console.log(`Looking for JAR at: ${jarPath}`)
  
  if (!fs.existsSync(jarPath)) {
    console.error(`\nError: JAR file not found at ${jarPath}`)
    console.error('\nTo generate the built-in catalog:')
    console.error('1. Copy your spacehaven.jar to the project root, or')
    console.error('2. Run: npx tsx scripts/generate-jar-catalog.ts /path/to/spacehaven.jar')
    console.error('\nWhere to find spacehaven.jar:')
    console.error('- Steam: Library → Space Haven → Properties → Installed Files → Browse')
    console.error('- Windows: C:\\Program Files (x86)\\Steam\\steamapps\\common\\SpaceHaven\\')
    console.error('- Linux: ~/.steam/steam/steamapps/common/SpaceHaven/')
    console.error('- macOS: ~/Library/Application Support/Steam/steamapps/common/SpaceHaven/')
    process.exit(1)
  }
  
  console.log('Reading JAR file...')
  const jarBytes = fs.readFileSync(jarPath)
  const stats = fs.statSync(jarPath)
  
  console.log('Parsing JAR contents...')
  const jarData = parseJarBytes(new Uint8Array(jarBytes))
  
  console.log(`Found ${jarData.structures.length} structures`)
  console.log(`Found ${jarData.texts.size} text entries`)
  console.log(`Found ${jarData.categories.length} categories`)
  if (jarData.gameVersion) {
    console.log(`Game version: ${jarData.gameVersion}`)
  }
  
  console.log('Converting to catalog format...')
  const catalog = convertToStructureCatalog(jarData)
  
  let totalStructures = 0
  for (const cat of catalog.categories) {
    console.log(`  ${cat.name}: ${cat.items.length} structures`)
    totalStructures += cat.items.length
  }
  console.log(`Total: ${totalStructures} structures in ${catalog.categories.length} categories`)
  
  console.log('Generating snapshot file...')
  const snapshotContent = generateSnapshotFile(catalog, {
    fileName: path.basename(jarPath),
    fileSize: stats.size,
    gameVersion: jarData.gameVersion,
  })
  
  const outputPath = path.join(
    process.cwd(),
    'src/data/jarCatalog/builtinSnapshot.ts'
  )
  
  fs.writeFileSync(outputPath, snapshotContent, 'utf-8')
  console.log(`\nSnapshot written to: ${outputPath}`)
  console.log('Done!')
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})

