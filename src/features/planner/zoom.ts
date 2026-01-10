// Shared zoom helpers for the Planner feature.
//
// IMPORTANT:
// - "100%" zoom in the UI is defined as "fit grid width into the available canvas area".
// - The available area depends on layout CSS values; keep these constants aligned with:
//   - `src/features/planner/PlannerPage.module.css`
//   - `src/features/planner/canvas/CanvasViewport.module.css`

// Layout constants (must match PlannerPage.module.css)
const LEFT_PANEL_WIDTH = 280
const RIGHT_PANEL_WIDTH = 320
const CANVAS_CONTAINER_PADDING = 24 * 2 // --spacing-xl on both sides

// Canvas styling constants (must match CanvasViewport.module.css)
const CANVAS_BORDER = 2 * 2 // 2px border on both sides

/**
 * Compute the pixels-per-tile zoom that fits the grid width into the available canvas area.
 * This value is the "100%" baseline used by the zoom percentage UI.
 */
export function calculateFitZoomForViewport(gridWidth: number, viewportWidth: number): number {
  if (!Number.isFinite(gridWidth) || gridWidth <= 0) return 1
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return 1

  const availableWidth =
    viewportWidth -
    LEFT_PANEL_WIDTH -
    RIGHT_PANEL_WIDTH -
    CANVAS_CONTAINER_PADDING -
    CANVAS_BORDER

  return Math.max(1, Math.floor(availableWidth / gridWidth))
}


