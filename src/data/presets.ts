import type { GridPreset, LayerId } from './types'

/**
 * Grid size presets matching Space Haven ship canvas sizes.
 * Each unit = 27 tiles (e.g., 2x2 = 54×54 tiles)
 */
export const GRID_PRESETS: readonly GridPreset[] = [
  { label: '1x1', width: 1, height: 1 },
  { label: '2x1', width: 2, height: 1 },
  { label: '1x2', width: 1, height: 2 },
  { label: '2x2', width: 2, height: 2 },
  { label: '3x1', width: 3, height: 1 },
  { label: '1x3', width: 1, height: 3 },
  { label: '3x2', width: 3, height: 2 },
  { label: '2x3', width: 2, height: 3 },
  { label: '3x3', width: 3, height: 3 },
] as const

/** Default grid preset (2x2) */
export const DEFAULT_PRESET = GRID_PRESETS[3]

/** All available layers in render order (bottom to top) */
export const LAYERS: readonly LayerId[] = ['Hull', 'Rooms', 'Systems', 'Furniture'] as const

/** Default zoom level in pixels per tile */
export const DEFAULT_ZOOM = 12

/** Zoom range limits */
export const ZOOM_MIN = 6
export const ZOOM_MAX = 72
export const ZOOM_STEP = 2

/** PNG export scale (pixels per tile) */
export const EXPORT_SCALE = 20
