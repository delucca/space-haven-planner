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
interface RawJarStructure {
  mid: number
  nameTid: number
  subCatId: number | null
  size: { width: number; height: number } | null
  debugName: string | null
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

// Category mapping
const JAR_CATEGORY_MAP: Record<
  number,
  { id: string; name: string; color: string; defaultLayer: string }
> = {
  1520: { id: 'hull', name: 'Hull & Walls', color: '#3a4a5c', defaultLayer: 'Hull' },
  1521: { id: 'power', name: 'Power', color: '#cc8844', defaultLayer: 'Systems' },
  1522: { id: 'life_support', name: 'Life Support', color: '#44aa88', defaultLayer: 'Systems' },
  1523: { id: 'system', name: 'Systems & Combat', color: '#cc4444', defaultLayer: 'Systems' },
  1524: { id: 'airlock', name: 'Airlock & Hangar', color: '#8866aa', defaultLayer: 'Rooms' },
  1525: { id: 'storage', name: 'Storage', color: '#888866', defaultLayer: 'Rooms' },
  1526: { id: 'food', name: 'Food & Agriculture', color: '#66aa44', defaultLayer: 'Rooms' },
  1527: { id: 'resource', name: 'Resource & Industry', color: '#aa8844', defaultLayer: 'Rooms' },
  1528: { id: 'facility', name: 'Crew Facilities', color: '#6688aa', defaultLayer: 'Rooms' },
  1529: { id: 'robots', name: 'Robots', color: '#55aaaa', defaultLayer: 'Systems' },
  1530: { id: 'furniture', name: 'Furniture & Decoration', color: '#aa8877', defaultLayer: 'Furniture' },
}

const DEFAULT_CATEGORY = {
  id: 'other',
  name: 'Other',
  color: '#888888',
  defaultLayer: 'Rooms',
}

function generateColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash % 360)
  const saturation = 40 + (Math.abs(hash >> 8) % 30)
  const lightness = 35 + (Math.abs(hash >> 16) % 20)
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
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
      // Extract name tid
      const catBlock = xml.slice(match.index, xml.indexOf('</cat>', match.index) + 6)
      const nameTidMatch = catBlock.match(/<name[^>]+tid="(\d+)"/)
      const nameTid = nameTidMatch ? parseInt(nameTidMatch[1], 10) : 0
      
      categories.push({ id, nameTid, parentId: null })
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
    
    // Extract size from restrictions
    let size: { width: number; height: number } | null = null
    const sizeMatch = meBlock.match(/sizeX="(\d+)"[^>]*sizeY="(\d+)"/)
    if (sizeMatch) {
      size = { width: parseInt(sizeMatch[1], 10), height: parseInt(sizeMatch[2], 10) }
    }
    
    // Extract debug name
    const debugNameMatch = match[0].match(/_name="([^"]*)"/)
    const debugName = debugNameMatch ? debugNameMatch[1] : null
    
    structures.push({ mid, nameTid, subCatId, size, debugName })
  }
  
  return { structures, categories }
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
    const directMapping = JAR_CATEGORY_MAP[jarCat.id]
    if (directMapping) {
      lookup.set(jarCat.id, directMapping.id)
      continue
    }
    
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

interface StructureDef {
  id: string
  name: string
  size: [number, number]
  color: string
  categoryId: string
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

function convertToStructureCatalog(jarData: ParsedJarData): StructureCatalog {
  const { structures, texts, categories: jarCategories } = jarData
  
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
    
    const color = generateColor(name)
    
    const structureDef: StructureDef = {
      id: `mid_${raw.mid}`,
      name,
      size,
      color,
      categoryId,
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
  const categoryOrder = [
    'hull', 'power', 'life_support', 'system', 'airlock',
    'storage', 'food', 'resource', 'facility', 'robots', 'furniture', 'other',
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

