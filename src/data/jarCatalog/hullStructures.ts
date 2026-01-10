/**
 * Wall category metadata (formerly "hull")
 *
 * The "Wall" category (JAR subCat 1522) contains doors, windows, and walls.
 * These structures are now extracted from the JAR, so manual definitions
 * are no longer needed. This file provides the category metadata.
 */

import type { StructureDef } from '@/data/types'

/**
 * Wall category metadata (for doors, windows, walls)
 * This matches the game's "WALL" category (JAR subCat 1522)
 */
export const HULL_CATEGORY = {
  id: 'wall',
  name: 'Wall',
  color: '#3a4a5c',
  defaultLayer: 'Hull' as const,
}

/**
 * Manual hull structures
 *
 * Note: Most wall structures (doors, windows, walls) are now extracted from
 * the JAR under subCat 1522 (WALL). This array is kept for backwards
 * compatibility but should be empty as structures come from the JAR.
 */
export const MANUAL_HULL_STRUCTURES: readonly StructureDef[] = []
