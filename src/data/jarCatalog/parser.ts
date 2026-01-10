/**
 * JAR file parser for Space Haven game data
 *
 * Extracts structure definitions from library/haven XML and
 * text localizations from library/texts XML.
 */

import { unzipSync } from 'fflate'
import type { ParsedJarData, RawJarStructure, RawJarCategory, TextEntry } from './types'

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
function extractEntry(
  unzipped: Record<string, Uint8Array>,
  path: string
): string | null {
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

  // Get parent category if any
  const parentIdStr = el.getAttribute('parent')
  const parentId = parentIdStr ? parseInt(parentIdStr, 10) : null

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

  // Get size from restrictions
  const size = parseStructureSize(objectInfo)

  // Get debug name if present
  const debugName = el.getAttribute('_name') || null

  return {
    mid,
    nameTid,
    subCatId: isNaN(subCatId ?? NaN) ? null : subCatId,
    size,
    debugName,
  }
}

/**
 * Parse structure size from objectInfo/restrictions
 *
 * The restrictions element contains placement rules with sizeX and sizeY.
 * We look for the largest footprint to determine the structure size.
 */
function parseStructureSize(
  objectInfo: Element
): { width: number; height: number } | null {
  const restrictions = objectInfo.querySelectorAll('restrictions l[sizeX][sizeY]')

  let maxWidth = 0
  let maxHeight = 0

  for (const restriction of restrictions) {
    const sizeXStr = restriction.getAttribute('sizeX')
    const sizeYStr = restriction.getAttribute('sizeY')

    if (sizeXStr && sizeYStr) {
      const sizeX = parseInt(sizeXStr, 10)
      const sizeY = parseInt(sizeYStr, 10)

      if (!isNaN(sizeX) && !isNaN(sizeY)) {
        // Track the maximum dimensions
        maxWidth = Math.max(maxWidth, sizeX)
        maxHeight = Math.max(maxHeight, sizeY)
      }
    }
  }

  // Also check for direct size attributes on data elements
  const dataElements = objectInfo.parentElement?.querySelectorAll('data l[sizeX][sizeY]')
  if (dataElements) {
    for (const dataEl of dataElements) {
      const sizeXStr = dataEl.getAttribute('sizeX')
      const sizeYStr = dataEl.getAttribute('sizeY')

      if (sizeXStr && sizeYStr) {
        const sizeX = parseInt(sizeXStr, 10)
        const sizeY = parseInt(sizeYStr, 10)

        if (!isNaN(sizeX) && !isNaN(sizeY)) {
          maxWidth = Math.max(maxWidth, sizeX)
          maxHeight = Math.max(maxHeight, sizeY)
        }
      }
    }
  }

  if (maxWidth > 0 && maxHeight > 0) {
    return { width: maxWidth, height: maxHeight }
  }

  // Fallback: check for grid-based size in the element hierarchy
  const gridElements = objectInfo.parentElement?.querySelectorAll('[gridOffX][gridOffY]')
  if (gridElements && gridElements.length > 0) {
    let minX = 0,
      maxX = 0,
      minY = 0,
      maxY = 0

    for (const gridEl of gridElements) {
      const x = parseInt(gridEl.getAttribute('gridOffX') || '0', 10)
      const y = parseInt(gridEl.getAttribute('gridOffY') || '0', 10)
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }

    const width = maxX - minX + 1
    const height = maxY - minY + 1

    if (width > 0 && height > 0) {
      return { width, height }
    }
  }

  return null
}

/**
 * Try to extract game version from JAR contents
 */
function extractGameVersion(
  unzipped: Record<string, Uint8Array>
): string | null {
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

