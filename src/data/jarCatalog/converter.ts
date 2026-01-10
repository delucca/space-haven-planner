/**
 * Converts parsed JAR data into StructureCatalog format
 */

import type { StructureCatalog, StructureCategory, StructureDef, LayerId, Size } from '@/data/types'
import type { ParsedJarData, RawJarStructure, RawJarCategory } from './types'

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

    // Find category metadata
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

  return {
    id: generateStructureId(raw.mid),
    name,
    size,
    color,
    categoryId,
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

