// Shared zoom helpers for the Planner feature.
//
// IMPORTANT:
// - "100%" zoom in the UI is defined as "fit grid width into the available canvas area".
// - The available area is now measured dynamically via ResizeObserver on the canvas container.

// Canvas styling constants (must match CanvasViewport.module.css)
const CANVAS_BORDER = 2 * 2 // 2px border on both sides

/**
 * Compute the pixels-per-tile zoom that fits the grid width into the available canvas area.
 * This value is the "100%" baseline used by the zoom percentage UI.
 *
 * @param gridWidth - The grid width in tiles
 * @param availableWidth - The measured content width of the canvas container (in pixels)
 */
export function calculateFitZoomForViewport(gridWidth: number, availableWidth: number): number {
  if (!Number.isFinite(gridWidth) || gridWidth <= 0) return 1
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return 1

  const usableWidth = availableWidth - CANVAS_BORDER

  return Math.max(1, Math.floor(usableWidth / gridWidth))
}
