import type {
  GridSize,
  GridPreset,
  HullTile,
  PlacedStructure,
  StructureCatalog,
  StructureDef,
  LayerId,
} from '@/data/types'
import type { ParsedShip } from './types'
import { findSmallestFittingPreset } from '@/data/presetsFit'

/**
 * Known floor/hull tile IDs from Space Haven saves.
 * These are tiles that should be treated as hull rather than structures.
 *
 * Based on observation of save files:
 * - 1146: Floor tile variant
 * - 1147: Floor tile variant
 * - 1148: Floor tile variant (most common)
 */
const KNOWN_HULL_MIDS = new Set([1146, 1147, 1148])

/**
 * Map system LayerId to default user layer ID
 */
const SYSTEM_LAYER_TO_USER_LAYER: Record<LayerId, string> = {
  Hull: 'layer-hull',
  Rooms: 'layer-rooms',
  Systems: 'layer-systems',
  Furniture: 'layer-furniture',
}

/**
 * Result of converting a ship to planner state
 */
export interface ShipConversionResult {
  /** The chosen grid preset */
  readonly preset: GridPreset
  /** Grid size in tiles */
  readonly gridSize: GridSize
  /** Hull tiles to place */
  readonly hullTiles: readonly HullTile[]
  /** Structures to place */
  readonly structures: readonly PlacedStructure[]
  /** Warnings about unknown structures or issues */
  readonly warnings: readonly ConversionWarning[]
  /** Statistics about the conversion */
  readonly stats: ConversionStats
}

/**
 * A warning generated during conversion
 */
export interface ConversionWarning {
  readonly type: 'unknown_structure' | 'parse_error' | 'bounds_exceeded'
  readonly message: string
  readonly mid?: number
  readonly count?: number
}

/**
 * Statistics about the conversion
 */
export interface ConversionStats {
  readonly totalElements: number
  readonly hullTilesCreated: number
  readonly structuresCreated: number
  readonly structuresSkipped: number
  readonly unknownMids: number
}

/**
 * Build a lookup map from mid to structure definition
 */
function buildMidToStructureMap(
  catalog: StructureCatalog
): Map<string, { def: StructureDef; categoryId: string; defaultLayer: LayerId }> {
  const map = new Map<string, { def: StructureDef; categoryId: string; defaultLayer: LayerId }>()

  for (const category of catalog.categories) {
    for (const item of category.items) {
      map.set(item.id, {
        def: item,
        categoryId: category.id,
        defaultLayer: category.defaultLayer,
      })
    }
  }

  return map
}

/**
 * Generate a unique ID for a placed structure
 */
function generateStructureId(): string {
  return `imported-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Convert a parsed ship to planner state.
 *
 * @param ship - The parsed ship data
 * @param catalog - The active structure catalog
 * @returns Conversion result with hull tiles, structures, and warnings
 */
export function convertShipToPlannerState(
  ship: ParsedShip,
  catalog: StructureCatalog
): ShipConversionResult {
  const { meta, elements } = ship

  // Find the smallest preset that fits the ship
  const preset = findSmallestFittingPreset(meta.width, meta.height)
  const gridSize: GridSize = { width: preset.width, height: preset.height }

  // Build lookup map for structures
  const midToStructure = buildMidToStructureMap(catalog)

  // Track hull tiles and structures
  const hullTileSet = new Set<string>()
  const structures: PlacedStructure[] = []
  const unknownMidCounts = new Map<number, number>()

  // Track processed multi-tile structure positions to avoid duplicates
  const processedMultiTilePositions = new Set<string>()

  for (const element of elements) {
    const { x, y, mid, rotation, isMultiTile, childTiles } = element

    // Skip empty tiles (m=-2 with no other data)
    if (mid === -2) {
      // Check if this position has hull-related flags (sh attribute indicates hull state)
      // For now, we'll skip pure empty tiles
      continue
    }

    // Check if this is a known hull/floor tile
    if (KNOWN_HULL_MIDS.has(mid)) {
      hullTileSet.add(`${x},${y}`)
      continue
    }

    // Try to find this structure in the catalog
    const structureKey = `mid_${mid}`
    const catalogEntry = midToStructure.get(structureKey)

    if (!catalogEntry) {
      // Unknown structure - might be hull or a structure not in catalog
      // Count it for the warning
      unknownMidCounts.set(mid, (unknownMidCounts.get(mid) || 0) + 1)

      // Treat as potential hull tile if it's not a multi-tile structure
      if (!isMultiTile) {
        hullTileSet.add(`${x},${y}`)
      }
      continue
    }

    // This is a known structure
    const { def, categoryId, defaultLayer } = catalogEntry

    if (isMultiTile && childTiles && childTiles.length > 0) {
      // Multi-tile structure: find the bounding box origin
      // The structure's position should be the minimum x,y of all child tiles
      const minX = Math.min(...childTiles.map((t) => t.x))
      const minY = Math.min(...childTiles.map((t) => t.y))

      // Check if we've already processed this structure (by its origin position)
      const posKey = `${structureKey}-${minX}-${minY}`
      if (processedMultiTilePositions.has(posKey)) {
        continue
      }
      processedMultiTilePositions.add(posKey)

      // Create the structure at the origin position
      const structure: PlacedStructure = {
        id: generateStructureId(),
        structureId: def.id,
        categoryId,
        x: minX,
        y: minY,
        rotation,
        layer: defaultLayer,
        orgLayerId: SYSTEM_LAYER_TO_USER_LAYER[defaultLayer],
        orgGroupId: null,
      }

      structures.push(structure)
    } else {
      // Single-tile structure
      const structure: PlacedStructure = {
        id: generateStructureId(),
        structureId: def.id,
        categoryId,
        x,
        y,
        rotation,
        layer: defaultLayer,
        orgLayerId: SYSTEM_LAYER_TO_USER_LAYER[defaultLayer],
        orgGroupId: null,
      }

      structures.push(structure)
    }
  }

  // Convert hull tile set to array
  const hullTiles: HullTile[] = []
  for (const key of hullTileSet) {
    const [xStr, yStr] = key.split(',')
    hullTiles.push({ x: parseInt(xStr, 10), y: parseInt(yStr, 10) })
  }

  // Generate warnings for unknown structures
  const warnings: ConversionWarning[] = []

  if (unknownMidCounts.size > 0) {
    const totalUnknown = Array.from(unknownMidCounts.values()).reduce((a, b) => a + b, 0)
    warnings.push({
      type: 'unknown_structure',
      message: `${totalUnknown} tiles with ${unknownMidCounts.size} unknown structure types were treated as hull. Import your spacehaven.jar to get all structure types.`,
      count: totalUnknown,
    })
  }

  // Check if ship exceeds preset bounds
  if (meta.width > preset.width || meta.height > preset.height) {
    warnings.push({
      type: 'bounds_exceeded',
      message: `Ship size (${meta.width}×${meta.height}) exceeds the largest available preset (${preset.width}×${preset.height}). Some content may be clipped.`,
    })
  }

  const stats: ConversionStats = {
    totalElements: elements.length,
    hullTilesCreated: hullTiles.length,
    structuresCreated: structures.length,
    structuresSkipped: 0,
    unknownMids: unknownMidCounts.size,
  }

  return {
    preset,
    gridSize,
    hullTiles,
    structures,
    warnings,
    stats,
  }
}

