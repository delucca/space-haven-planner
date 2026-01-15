import type { GridPreset, LayerId } from './types'

/**
 * Grid size presets matching Space Haven ship canvas sizes.
 * Each unit = 27 tiles (e.g., 2x2 = 54×54 tiles)
 *
 * Extended to support larger ships that can be imported from save files.
 * In-game ships can be up to 8x8 units.
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
  { label: '3x3', width: 81, height: 81 },
  { label: '4x3', width: 108, height: 81 },
  { label: '3x4', width: 81, height: 108 },
  { label: '4x4', width: 108, height: 108 },
  { label: '5x4', width: 135, height: 108 },
  { label: '4x5', width: 108, height: 135 },
  { label: '5x5', width: 135, height: 135 },
  { label: '6x5', width: 162, height: 135 },
  { label: '5x6', width: 135, height: 162 },
  { label: '6x6', width: 162, height: 162 },
  { label: '7x6', width: 189, height: 162 },
  { label: '6x7', width: 162, height: 189 },
  { label: '7x7', width: 189, height: 189 },
  { label: '8x7', width: 216, height: 189 },
  { label: '7x8', width: 189, height: 216 },
  { label: '8x8', width: 216, height: 216 },
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
