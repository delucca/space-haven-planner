/**
 * JAR file parser for Space Haven game data
 *
 * Extracts structure definitions from library/haven XML and
 * text localizations from library/texts XML.
 */

import { unzipSync } from 'fflate'
import type {
  ParsedJarData,
  RawJarStructure,
  RawJarCategory,
  RawJarTile,
  RawJarLinkedTile,
  RawJarRestriction,
  TextEntry,
} from './types'

/**
 * Entry paths within the JAR file
 */
const LIBRARY_HAVEN_PATH = 'library/haven'
const LIBRARY_TEXTS_PATH = 'library/texts'

/**
 * Parse a Space Haven JAR file and extract structure data
 */
export async function parseJarFile(file: File): Promise<ParsedJarData> {
  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)

  // Unzip the JAR (it's just a ZIP file)
  const unzipped = unzipSync(uint8Array)

  // Extract required files
  const havenXml = extractEntry(unzipped, LIBRARY_HAVEN_PATH)
  const textsXml = extractEntry(unzipped, LIBRARY_TEXTS_PATH)

  if (!havenXml) {
    throw new Error(`JAR file is missing ${LIBRARY_HAVEN_PATH}`)
  }
  if (!textsXml) {
    throw new Error(`JAR file is missing ${LIBRARY_TEXTS_PATH}`)
  }

  // Parse XML files
  const texts = parseTextsXml(textsXml)
  const { structures, categories } = parseHavenXml(havenXml)

  // Try to extract game version (may be in various places)
  const gameVersion = extractGameVersion(unzipped)

  return {
    structures,
    texts,
    categories,
    gameVersion,
  }
}

/**
 * Parse JAR from raw bytes (for Node.js script usage)
 */
export function parseJarBytes(bytes: Uint8Array): ParsedJarData {
  const unzipped = unzipSync(bytes)

  const havenXml = extractEntry(unzipped, LIBRARY_HAVEN_PATH)
  const textsXml = extractEntry(unzipped, LIBRARY_TEXTS_PATH)

  if (!havenXml) {
    throw new Error(`JAR file is missing ${LIBRARY_HAVEN_PATH}`)
  }
  if (!textsXml) {
    throw new Error(`JAR file is missing ${LIBRARY_TEXTS_PATH}`)
  }

  const texts = parseTextsXml(textsXml)
  const { structures, categories } = parseHavenXml(havenXml)
  const gameVersion = extractGameVersion(unzipped)

  return {
    structures,
    texts,
    categories,
    gameVersion,
  }
}

/**
 * Extract a file entry from unzipped data
 */
function extractEntry(unzipped: Record<string, Uint8Array>, path: string): string | null {
  const data = unzipped[path]
  if (!data) return null
  return new TextDecoder('utf-8').decode(data)
}

/**
 * Parse library/texts XML to extract text localizations
 * Exported for testing
 *
 * The texts file uses this format:
 * <t>
 *   <t id="54" pid="52">
 *     <EN>Crate</EN>
 *     <ES>Caja</ES>
 *     ...
 *   </t>
 * </t>
 */
export function parseTextsXml(xml: string): ReadonlyMap<number, string> {
  const texts = new Map<number, string>()

  // Parse XML using DOMParser
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')

  // Find all <t> elements with id attribute
  const textElements = doc.querySelectorAll('t[id]')

  for (const el of textElements) {
    const idStr = el.getAttribute('id')
    if (!idStr) continue

    const id = parseInt(idStr, 10)
    if (isNaN(id)) continue

    // Try to get English text from EN child element first (new format)
    const enElement = el.querySelector('EN')
    if (enElement?.textContent) {
      texts.set(id, enElement.textContent.trim())
      continue
    }

    // Fallback to EN attribute (old format)
    const enAttr = el.getAttribute('EN')
    if (enAttr) {
      texts.set(id, enAttr)
    }
  }

  return texts
}

/**
 * Parse library/haven XML to extract structures and categories
 * Exported for testing
 */
export function parseHavenXml(xml: string): {
  structures: RawJarStructure[]
  categories: RawJarCategory[]
} {
  const structures: RawJarStructure[] = []
  const categories: RawJarCategory[] = []

  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')

  // Parse categories from <cat> elements
  const catElements = doc.querySelectorAll('cat[id]')
  for (const el of catElements) {
    const category = parseCategoryElement(el)
    if (category) {
      categories.push(category)
    }
  }

  // Parse structures from <me> elements with objectInfo
  // These are the placeable/buildable structures
  const meElements = doc.querySelectorAll('me[mid]')

  for (const el of meElements) {
    const structure = parseStructureElement(el)
    if (structure) {
      structures.push(structure)
    }
  }

  return { structures, categories }
}

/**
 * Parse a single <cat> category element
 */
function parseCategoryElement(el: Element): RawJarCategory | null {
  const idStr = el.getAttribute('id')
  if (!idStr) return null

  const id = parseInt(idStr, 10)
  if (isNaN(id)) return null

  // Get name tid from <name tid="..."/>
  const nameEl = el.querySelector('name[tid]')
  const nameTidStr = nameEl?.getAttribute('tid')
  const nameTid = nameTidStr ? parseInt(nameTidStr, 10) : 0

  // Get parent MainCat from <mainCat id="..."/>
  const mainCatEl = el.querySelector('mainCat[id]')
  const mainCatIdStr = mainCatEl?.getAttribute('id')
  const parentId = mainCatIdStr ? parseInt(mainCatIdStr, 10) : null

  return {
    id,
    nameTid,
    parentId: isNaN(parentId ?? NaN) ? null : parentId,
  }
}

/**
 * Parse a single <me> structure element
 */
function parseStructureElement(el: Element): RawJarStructure | null {
  const midStr = el.getAttribute('mid')
  if (!midStr) return null

  const mid = parseInt(midStr, 10)
  if (isNaN(mid)) return null

  // Get objectInfo element - this indicates it's a placeable structure
  const objectInfo = el.querySelector('objectInfo')
  if (!objectInfo) return null

  // Get name tid from objectInfo/name[@tid]
  const nameEl = objectInfo.querySelector('name[tid]')
  const nameTidStr = nameEl?.getAttribute('tid')
  const nameTid = nameTidStr ? parseInt(nameTidStr, 10) : 0

  if (nameTid === 0) return null // Skip structures without names

  // Get subcategory from objectInfo/subCat[@id]
  const subCatEl = objectInfo.querySelector('subCat[id]')
  const subCatIdStr = subCatEl?.getAttribute('id')
  const subCatId = subCatIdStr ? parseInt(subCatIdStr, 10) : null

  // Get debug name if present
  const debugName = el.getAttribute('_name') || null

  // Parse tile data from <data> section
  const tiles = parseStructureTiles(el)

  // Parse linked elements - these define the actual construction footprint
  const linkedTiles = parseLinkedTiles(el)

  // Parse restriction tiles from objectInfo/restrictions
  const restrictions = parseStructureRestrictions(objectInfo)

  // Calculate size from linked tiles (primary) or data tiles (fallback)
  const size = calculateStructureSize(tiles, linkedTiles)

  return {
    mid,
    nameTid,
    subCatId: isNaN(subCatId ?? NaN) ? null : subCatId,
    size,
    debugName,
    tiles,
    linkedTiles,
    restrictions,
  }
}

/**
 * Parse tile data from the <data> section of a structure
 * Each <l> element with gridOffX/gridOffY represents a tile
 */
function parseStructureTiles(structureEl: Element): RawJarTile[] {
  const tiles: RawJarTile[] = []
  const dataEl = structureEl.querySelector('data')
  if (!dataEl) return tiles

  // Find all <l> elements with grid offsets
  const tileElements = dataEl.querySelectorAll('l[gridOffX][gridOffY]')

  for (const tileEl of tileElements) {
    const gridOffXStr = tileEl.getAttribute('gridOffX')
    const gridOffYStr = tileEl.getAttribute('gridOffY')
    const elementType = tileEl.getAttribute('type') || 'Unknown'

    if (!gridOffXStr || !gridOffYStr) continue

    const gridOffX = parseInt(gridOffXStr, 10)
    const gridOffY = parseInt(gridOffYStr, 10)

    if (isNaN(gridOffX) || isNaN(gridOffY)) continue

    // Get walkGridCost from the nested <element> if present
    const elementEl = tileEl.querySelector('element[walkGridCost]')
    const walkGridCostStr = elementEl?.getAttribute('walkGridCost')
    const walkGridCost = walkGridCostStr ? parseInt(walkGridCostStr, 10) : 1 // Default to normal walkable

    tiles.push({
      gridOffX,
      gridOffY,
      elementType,
      walkGridCost: isNaN(walkGridCost) ? 1 : walkGridCost,
    })
  }

  return tiles
}

/**
 * Parse linked elements from <linked> section
 * These define the actual construction tiles that make up the structure
 */
function parseLinkedTiles(structureEl: Element): RawJarLinkedTile[] {
  const linkedTiles: RawJarLinkedTile[] = []
  const linkedEl = structureEl.querySelector('linked')
  if (!linkedEl) return linkedTiles

  // Find all <l> elements with grid offsets in linked section
  const linkElements = linkedEl.querySelectorAll('l[gridOffX][gridOffY]')

  for (const linkEl of linkElements) {
    const idStr = linkEl.getAttribute('id')
    const eidStr = linkEl.getAttribute('eid')
    const gridOffXStr = linkEl.getAttribute('gridOffX')
    const gridOffYStr = linkEl.getAttribute('gridOffY')
    const rot = linkEl.getAttribute('rot') || 'R0'

    if (!gridOffXStr || !gridOffYStr) continue

    const id = idStr ? parseInt(idStr, 10) : 0
    const eid = eidStr ? parseInt(eidStr, 10) : 0
    const gridOffX = parseInt(gridOffXStr, 10)
    const gridOffY = parseInt(gridOffYStr, 10)

    if (isNaN(gridOffX) || isNaN(gridOffY)) continue

    linkedTiles.push({
      id: isNaN(id) ? 0 : id,
      eid: isNaN(eid) ? 0 : eid,
      gridOffX,
      gridOffY,
      rot,
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
 * Parse restriction tiles from objectInfo/restrictions
 * These define required floor/space around the structure
 */
function parseStructureRestrictions(objectInfo: Element): RawJarRestriction[] {
  const restrictions: RawJarRestriction[] = []
  const restrictionsEl = objectInfo.querySelector('restrictions')
  if (!restrictionsEl) return restrictions

  const restrictionElements = restrictionsEl.querySelectorAll('l[type]')

  for (const el of restrictionElements) {
    const type = el.getAttribute('type') || 'Unknown'
    const gridXStr = el.getAttribute('gridX')
    const gridYStr = el.getAttribute('gridY')
    const sizeXStr = el.getAttribute('sizeX')
    const sizeYStr = el.getAttribute('sizeY')

    const gridX = gridXStr ? parseInt(gridXStr, 10) : 0
    const gridY = gridYStr ? parseInt(gridYStr, 10) : 0
    const sizeX = sizeXStr ? parseInt(sizeXStr, 10) : 1
    const sizeY = sizeYStr ? parseInt(sizeYStr, 10) : 1

    restrictions.push({
      type,
      gridX: isNaN(gridX) ? 0 : gridX,
      gridY: isNaN(gridY) ? 0 : gridY,
      sizeX: isNaN(sizeX) ? 1 : sizeX,
      sizeY: isNaN(sizeY) ? 1 : sizeY,
    })
  }

  return restrictions
}

/**
 * Try to extract game version from JAR contents
 */
function extractGameVersion(unzipped: Record<string, Uint8Array>): string | null {
  // Try library/Version____PC____ first (contains version string)
  const versionFile = unzipped['library/Version____PC____'] || unzipped['library/version']
  if (versionFile) {
    const content = new TextDecoder('utf-8').decode(versionFile).trim()
    if (content) {
      return content
    }
  }

  // Try to extract from haven XML libVersion attribute
  const havenData = unzipped[LIBRARY_HAVEN_PATH]
  if (havenData) {
    const havenXml = new TextDecoder('utf-8').decode(havenData)
    const versionMatch = havenXml.match(/libVersion="([^"]+)"/)
    if (versionMatch) {
      return versionMatch[1]
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

/**
 * Export text entries for external use
 */
export function extractTextEntries(texts: ReadonlyMap<number, string>): TextEntry[] {
  return Array.from(texts.entries()).map(([id, en]) => ({ id, en }))
}
