import type { GridPreset, GridSize } from './types'
import { GRID_PRESETS, DEFAULT_PRESET } from './presets'

/**
 * Find the smallest preset that can fit the given ship dimensions.
 *
 * @param shipWidth - Width of the ship in tiles
 * @param shipHeight - Height of the ship in tiles
 * @returns The smallest preset that fits, or the largest preset if none fit
 */
export function findSmallestFittingPreset(shipWidth: number, shipHeight: number): GridPreset {
  // Sort presets by area (smallest first), then by width for consistent ordering
  const sortedPresets = [...GRID_PRESETS].sort((a, b) => {
    const areaA = a.width * a.height
    const areaB = b.width * b.height
    if (areaA !== areaB) return areaA - areaB
    return a.width - b.width
  })

  // Find the first preset that fits
  for (const preset of sortedPresets) {
    if (preset.width >= shipWidth && preset.height >= shipHeight) {
      return preset
    }
  }

  // If no preset fits, return the largest one
  return sortedPresets[sortedPresets.length - 1]
}

/**
 * Find a preset by its label.
 *
 * @param label - The preset label (e.g., "2x2", "3x3")
 * @returns The matching preset, or DEFAULT_PRESET if not found
 */
export function findPresetByLabel(label: string): GridPreset {
  return GRID_PRESETS.find((p) => p.label === label) ?? DEFAULT_PRESET
}

/**
 * Get the grid size from a preset.
 */
export function getGridSizeFromPreset(preset: GridPreset): GridSize {
  return { width: preset.width, height: preset.height }
}

/**
 * Check if a ship size fits within a preset.
 */
export function shipFitsInPreset(
  shipWidth: number,
  shipHeight: number,
  preset: GridPreset
): boolean {
  return preset.width >= shipWidth && preset.height >= shipHeight
}



