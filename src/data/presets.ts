import type { GridPreset, LayerId } from './types'

/**
 * Grid size presets matching Space Haven ship canvas sizes.
 * Each unit = 27 tiles (e.g., 2x2 = 54×54 tiles)
 */
export const GRID_PRESETS: readonly GridPreset[] = [
  { label: '1x1', width: 27, height: 27 },
  { label: '2x1', width: 54, height: 27 },
  { label: '1x2', width: 27, height: 54 },
  { label: '2x2', width: 54, height: 54 },
  { label: '3x1', width: 81, height: 27 },
  { label: '1x3', width: 27, height: 81 },
  { label: '3x2', width: 81, height: 54 },
  { label: '2x3', width: 54, height: 81 },
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
