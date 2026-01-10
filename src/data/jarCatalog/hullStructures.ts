/**
 * Manual hull-related structures that aren't in the JAR build menu
 *
 * These are structures from the game's "Edit" mode that need to be
 * manually added to the catalog since they're not extracted from the JAR.
 */

import type { StructureDef } from '@/data/types'

/**
 * Hull category metadata
 */
export const HULL_CATEGORY = {
  id: 'hull',
  name: 'Hull & Structure',
  color: '#3a4a5c',
  defaultLayer: 'Hull' as const,
}

/**
 * Manual hull structures (walls, doors, windows)
 *
 * Note: Basic hull tiles are painted with the Hull tool, not placed as structures.
 * These are the placeable hull-related items like doors and windows.
 */
export const MANUAL_HULL_STRUCTURES: readonly StructureDef[] = [
  // Walls
  {
    id: 'wall_x1',
    name: 'X1 Wall',
    size: [1, 1],
    color: '#5a6a7c',
    categoryId: 'hull',
  },

  // Doors
  {
    id: 'door_x1',
    name: 'X1 Door',
    size: [1, 1],
    color: '#6a8a9c',
    categoryId: 'hull',
  },
  {
    id: 'door_x2',
    name: 'X2 Door',
    size: [2, 1],
    color: '#6a8a9c',
    categoryId: 'hull',
  },
  {
    id: 'spacesuit_door',
    name: 'Spacesuit Door',
    size: [1, 1],
    color: '#7a9aac',
    categoryId: 'hull',
  },

  // Windows
  {
    id: 'window_2',
    name: 'Window 2-tile',
    size: [2, 1],
    color: '#8ab4cc',
    categoryId: 'hull',
  },
  {
    id: 'window_3',
    name: 'Window 3-tile',
    size: [3, 1],
    color: '#8ab4cc',
    categoryId: 'hull',
  },
  {
    id: 'window_4',
    name: 'Window 4-tile',
    size: [4, 1],
    color: '#8ab4cc',
    categoryId: 'hull',
  },
]

