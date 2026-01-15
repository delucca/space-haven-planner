import type {
  GridSize,
  PlacedStructure,
  StructureCatalog,
  StructureTile,
  Rotation,
  UserLayer,
  UserGroup,
} from '@/data/types'
import { findStructureById, getRotatedSize } from '@/data'
import { computePerimeterEdges, isInnerHullTile } from './hullPerimeter'

/**
 * Visibility state needed for rendering
 */
export interface VisibilityState {
  userLayers: readonly UserLayer[]
  userGroups: readonly UserGroup[]
}

/**
 * Check if a structure is visible based on its layer and group visibility
 */
function isStructureVisibleForRender(visState: VisibilityState, struct: PlacedStructure): boolean {
  // Check user layer visibility
  const layer = visState.userLayers.find((l) => l.id === struct.orgLayerId)
  if (!layer || !layer.isVisible) return false

  // Check group visibility if structure is in a group
  if (struct.orgGroupId) {
    const group = visState.userGroups.find((g) => g.id === struct.orgGroupId)
    if (group && !group.isVisible) return false
  }

  return true
}

/** Colors for rendering */
const COLORS = {
  background: '#1a1e24',
  gridLine: '#2a3040',
  centerLine: '#1a5a5a', // Teal/cyan color for center crosshair lines
  previewValid: 'rgba(136, 255, 136, 0.5)',
  previewInvalid: 'rgba(255, 68, 68, 0.4)',
  previewBorderValid: '#88ff88',
  previewBorderInvalid: '#ff4444',
  structureBorder: 'rgba(255, 255, 255, 0.3)',
  structureBorderAccess: 'rgba(255, 255, 255, 0.1)', // Lighter border for access tiles
  structureText: '#ffffff',
  structureTextShadow: '#000000',
  hullTile: '#3a4a5c',
  hullTileInner: '#2a3a4c', // Slightly darker for inner tiles
  hullGridLine: 'rgba(255, 255, 255, 0.08)', // Subtle internal grid for hull tiles
  hullWall: '#5a6a7c',
  hullPreview: 'rgba(74, 90, 108, 0.6)',
  hullPreviewBorder: '#6a8a9c',
  selectionFill: 'rgba(130, 200, 255, 0.12)',
  selectionBorder: 'rgba(130, 200, 255, 0.85)',
  selectionEraseFill: 'rgba(255, 68, 68, 0.12)',
  selectionEraseBorder: 'rgba(255, 68, 68, 0.85)',
  selectionHullPlaceFill: 'rgba(74, 90, 108, 0.35)',
  selectionHullEraseFill: 'rgba(180, 60, 60, 0.25)',
  // Tile type colors (for detailed structure rendering)
  // Construction tiles: use full structure color (solid object)
  // Access tiles: semi-transparent, can overlap (crew access area)
  // Blocked tiles: red overlay (impassable)
  accessTileOpacity: 0.25, // Access tiles are more transparent
  blockedTileOverlay: 'rgba(180, 60, 60, 0.5)', // Red overlay for blocked
}

export interface RenderContext {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  gridSize: GridSize
  zoom: number
  dpr: number
}

export interface PreviewInfo {
  x: number
  y: number
  width: number
  height: number
  color: string
  isValid: boolean
  rotation: Rotation
  tileLayout?: {
    tiles: readonly StructureTile[]
    width: number
    height: number
  }
}

export interface HullPreviewInfo {
  x: number
  y: number
}

export type SelectionOverlayMode = 'hull_place' | 'hull_erase' | 'select' | 'erase'

export interface SelectionOverlayRect {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface SelectionOverlay {
  mode: SelectionOverlayMode
  rect: SelectionOverlayRect
  /** Optional: used by erase/select modes to highlight only existing hull tiles */
  hullTiles?: ReadonlySet<string>
  /** Optional: size-based bounds to highlight selected structures */
  structureBounds?: readonly { x: number; y: number; width: number; height: number }[]
}

/**
 * Create a render context for the canvas
 */
export function createRenderContext(
  canvas: HTMLCanvasElement,
  gridSize: GridSize,
  zoom: number
): RenderContext {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get 2D context')
  }

  const dpr = window.devicePixelRatio || 1
  const width = gridSize.width * zoom
  const height = gridSize.height * zoom

  // Set display size
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  // Set actual size in memory (scaled for DPR)
  canvas.width = width * dpr
  canvas.height = height * dpr

  // Scale context to match DPR
  ctx.scale(dpr, dpr)

  return { canvas, ctx, gridSize, zoom, dpr }
}

/**
 * Clear the canvas with background color
 */
export function clearCanvas(rc: RenderContext): void {
  rc.ctx.fillStyle = COLORS.background
  rc.ctx.fillRect(0, 0, rc.gridSize.width * rc.zoom, rc.gridSize.height * rc.zoom)
}

/**
 * Render grid lines
 */
export function renderGrid(rc: RenderContext): void {
  const { ctx, gridSize, zoom } = rc

  ctx.strokeStyle = COLORS.gridLine
  ctx.lineWidth = 1

  // Vertical lines
  for (let x = 0; x <= gridSize.width; x++) {
    ctx.beginPath()
    ctx.moveTo(x * zoom + 0.5, 0)
    ctx.lineTo(x * zoom + 0.5, gridSize.height * zoom)
    ctx.stroke()
  }

  // Horizontal lines
  for (let y = 0; y <= gridSize.height; y++) {
    ctx.beginPath()
    ctx.moveTo(0, y * zoom + 0.5)
    ctx.lineTo(gridSize.width * zoom, y * zoom + 0.5)
    ctx.stroke()
  }
}

/**
 * Render center crosshair lines (thick lines marking the center of the grid)
 * These appear below hull tiles and structures, similar to the game's grid
 */
export function renderCenterLines(rc: RenderContext): void {
  const { ctx, gridSize, zoom } = rc

  ctx.strokeStyle = COLORS.centerLine
  ctx.lineWidth = 3 // Thicker than regular grid lines

  // Calculate center positions (at the edge between two center tiles)
  const centerX = Math.floor(gridSize.width / 2) * zoom
  const centerY = Math.floor(gridSize.height / 2) * zoom

  // Vertical center line
  ctx.beginPath()
  ctx.moveTo(centerX + 0.5, 0)
  ctx.lineTo(centerX + 0.5, gridSize.height * zoom)
  ctx.stroke()

  // Horizontal center line
  ctx.beginPath()
  ctx.moveTo(0, centerY + 0.5)
  ctx.lineTo(gridSize.width * zoom, centerY + 0.5)
  ctx.stroke()
}

/**
 * Rotate a tile position based on structure rotation
 * Assumes the structure's origin is at (0,0) and rotates around the center
 */
function rotateTilePosition(
  tile: StructureTile,
  rotation: Rotation,
  layoutWidth: number,
  layoutHeight: number
): { x: number; y: number } {
  const { x, y } = tile

  switch (rotation) {
    case 0:
      return { x, y }
    case 90:
      // Rotate 90° clockwise: (x, y) -> (height - 1 - y, x)
      return { x: layoutHeight - 1 - y, y: x }
    case 180:
      // Rotate 180°: (x, y) -> (width - 1 - x, height - 1 - y)
      return { x: layoutWidth - 1 - x, y: layoutHeight - 1 - y }
    case 270:
      // Rotate 270° clockwise (90° counter-clockwise): (x, y) -> (y, width - 1 - x)
      return { x: y, y: layoutWidth - 1 - x }
    default:
      return { x, y }
  }
}

/**
 * Parse HSL color string and return components
 * Handles format: hsl(h, s%, l%)
 */
function parseHslColor(color: string): { h: number; s: number; l: number } | null {
  const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
  if (match) {
    return {
      h: parseInt(match[1], 10),
      s: parseInt(match[2], 10),
      l: parseInt(match[3], 10),
    }
  }
  return null
}

/**
 * Convert HSL to HSLA string with alpha
 */
function hslToHsla(color: string, alpha: number): string {
  const hsl = parseHslColor(color)
  if (hsl) {
    return `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${alpha})`
  }
  // Fallback: append alpha to hex/rgb colors
  return color.replace(')', `, ${alpha})`).replace('rgb(', 'rgba(')
}

/**
 * Render a single placed structure
 *
 * Tile types are rendered differently:
 * - Construction: Solid color (the actual structure)
 * - Access: Semi-transparent (crew can walk here, can overlap with other access)
 * - Blocked: Red overlay (impassable)
 *
 * @param renderedAccessTiles - Set of already rendered access tile keys to prevent double-rendering
 */
export function renderStructure(
  rc: RenderContext,
  structure: PlacedStructure,
  catalog: StructureCatalog,
  renderedAccessTiles?: Set<string>
): void {
  const found = findStructureById(catalog, structure.structureId)
  if (!found) return

  const { ctx, zoom } = rc
  const structureDef = found.structure
  const [width, height] = getRotatedSize(structureDef.size, structure.rotation)

  const baseX = structure.x * zoom
  const baseY = structure.y * zoom
  const w = width * zoom
  const h = height * zoom

  // Check if we have detailed tile layout
  if (structureDef.tileLayout && structureDef.tileLayout.tiles.length > 0) {
    // Render with detailed tile layout
    const { tiles, width: layoutWidth, height: layoutHeight } = structureDef.tileLayout

    for (const tile of tiles) {
      // Rotate tile position based on structure rotation
      const rotatedPos = rotateTilePosition(tile, structure.rotation, layoutWidth, layoutHeight)

      const worldX = structure.x + rotatedPos.x
      const worldY = structure.y + rotatedPos.y
      const tileKey = `${worldX},${worldY}`
      const tileX = worldX * zoom
      const tileY = worldY * zoom

      if (tile.type === 'access') {
        // Skip rendering if this access tile was already rendered by another structure
        if (renderedAccessTiles?.has(tileKey)) {
          continue
        }

        // Mark this access tile as rendered
        renderedAccessTiles?.add(tileKey)

        // Access tiles: semi-transparent, with dashed border
        // These represent areas where crew can walk/access the structure
        ctx.fillStyle = hslToHsla(structureDef.color, COLORS.accessTileOpacity)
        ctx.fillRect(tileX, tileY, zoom, zoom)

        // Dashed border for access tiles
        ctx.setLineDash([2, 2])
        ctx.strokeStyle = COLORS.structureBorderAccess
        ctx.lineWidth = 1
        ctx.strokeRect(tileX + 0.5, tileY + 0.5, zoom - 1, zoom - 1)
        ctx.setLineDash([])
      } else if (tile.type === 'blocked') {
        // Blocked tiles: solid red color (space/impassable areas)
        ctx.fillStyle = 'rgba(140, 50, 50, 0.9)'
        ctx.fillRect(tileX, tileY, zoom, zoom)

        // Red border for blocked
        ctx.strokeStyle = 'rgba(180, 60, 60, 1)'
        ctx.lineWidth = 1
        ctx.strokeRect(tileX + 0.5, tileY + 0.5, zoom - 1, zoom - 1)
      } else {
        // Construction tiles: solid color (the actual structure)
        ctx.fillStyle = structureDef.color
        ctx.fillRect(tileX, tileY, zoom, zoom)

        // Solid border
        ctx.strokeStyle = COLORS.structureBorder
        ctx.lineWidth = 1
        ctx.strokeRect(tileX + 0.5, tileY + 0.5, zoom - 1, zoom - 1)
      }
    }
  } else {
    // Fallback: render as solid rectangle (old behavior)
    ctx.fillStyle = structureDef.color
    ctx.fillRect(baseX, baseY, w, h)

    // Border
    ctx.strokeStyle = COLORS.structureBorder
    ctx.lineWidth = 1
    ctx.strokeRect(baseX + 0.5, baseY + 0.5, w - 1, h - 1)
  }

  // Label (only if zoom is large enough)
  // Skip labels for hull-related structures (hull, walls, windows, doors)
  const hullRelatedNames = ['wall', 'door', 'window', 'hull']
  const isHullRelated = hullRelatedNames.some((name) =>
    structureDef.name.toLowerCase().includes(name)
  )

  if (zoom >= 10 && !isHullRelated) {
    // Calculate center of solid tiles (construction + blocked, NOT access)
    // These are the tiles that form the actual visible structure
    let solidMinX = Infinity,
      solidMaxX = -Infinity,
      solidMinY = Infinity,
      solidMaxY = -Infinity
    let hasSolidTiles = false

    if (structureDef.tileLayout && structureDef.tileLayout.tiles.length > 0) {
      const { tiles, width: layoutWidth, height: layoutHeight } = structureDef.tileLayout

      for (const tile of tiles) {
        // Include both construction and blocked tiles as "solid" (the actual structure)
        // Access tiles are transparent walkable areas, not part of the solid structure
        if (tile.type === 'construction' || tile.type === 'blocked') {
          const rotatedPos = rotateTilePosition(tile, structure.rotation, layoutWidth, layoutHeight)
          const worldX = structure.x + rotatedPos.x
          const worldY = structure.y + rotatedPos.y

          solidMinX = Math.min(solidMinX, worldX)
          solidMaxX = Math.max(solidMaxX, worldX)
          solidMinY = Math.min(solidMinY, worldY)
          solidMaxY = Math.max(solidMaxY, worldY)
          hasSolidTiles = true
        }
      }
    }

    // If no solid tiles found, use the full bounding box
    if (!hasSolidTiles) {
      solidMinX = structure.x
      solidMaxX = structure.x + width - 1
      solidMinY = structure.y
      solidMaxY = structure.y + height - 1
    }

    // Calculate center of solid area in pixels
    const solidCenterX = ((solidMinX + solidMaxX + 1) / 2) * zoom
    const solidCenterY = ((solidMinY + solidMaxY + 1) / 2) * zoom

    const fontSize = Math.min(zoom * 0.6, 10)
    ctx.font = `${fontSize}px monospace`
    ctx.fillStyle = COLORS.structureText
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = COLORS.structureTextShadow
    ctx.shadowBlur = 2
    ctx.shadowOffsetX = 1
    ctx.shadowOffsetY = 1

    // Show full text, allow overflow
    const text = structureDef.name

    ctx.fillText(text, solidCenterX, solidCenterY)

    // Reset shadow
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
  }
}

/**
 * Render all placed structures
 * Tracks rendered access tiles to prevent double-rendering overlapping access areas
 */
export function renderStructures(
  rc: RenderContext,
  structures: readonly PlacedStructure[],
  catalog: StructureCatalog,
  visibilityState: VisibilityState
): void {
  // Track which access tiles have been rendered to avoid double-rendering
  const renderedAccessTiles = new Set<string>()

  for (const structure of structures) {
    if (isStructureVisibleForRender(visibilityState, structure)) {
      renderStructure(rc, structure, catalog, renderedAccessTiles)
    }
  }
}

/**
 * Render all hull tiles as a merged surface with perimeter walls as edge segments.
 *
 * Hull tiles are rendered as a continuous floor (no internal seams between adjacent tiles).
 * Auto-walls are drawn as edge segments along the perimeter using 4-neighbor adjacency
 * (no diagonal wall tiles). This creates a cleaner, more game-like appearance.
 */
export function renderHullTiles(rc: RenderContext, hullTiles: ReadonlySet<string>): void {
  // Hull tiles are always visible (they're painted directly, not tied to user layers)
  if (hullTiles.size === 0) return

  const { ctx, zoom } = rc

  // Wall edge thickness (in pixels, scales with zoom)
  const wallThickness = Math.max(2, Math.floor(zoom * 0.15))

  // Compute perimeter edges using 4-neighbor adjacency
  const edges = computePerimeterEdges(hullTiles)

  // 1) Render hull floor tiles as a merged surface
  for (const key of hullTiles) {
    const [xStr, yStr] = key.split(',')
    const tileX = parseInt(xStr, 10)
    const tileY = parseInt(yStr, 10)

    const x = tileX * zoom
    const y = tileY * zoom

    // Use slightly darker color for inner tiles (fully surrounded) for subtle depth
    const isInner = isInnerHullTile(hullTiles, tileX, tileY)
    ctx.fillStyle = isInner ? COLORS.hullTileInner : COLORS.hullTile
    ctx.fillRect(x, y, zoom, zoom)
  }

  // 2) Render subtle internal grid lines between adjacent hull tiles (helps with placement)
  ctx.strokeStyle = COLORS.hullGridLine
  ctx.lineWidth = 1
  for (const key of hullTiles) {
    const [xStr, yStr] = key.split(',')
    const tileX = parseInt(xStr, 10)
    const tileY = parseInt(yStr, 10)

    const x = tileX * zoom
    const y = tileY * zoom

    // Draw internal grid lines only where there's an adjacent hull tile
    // This creates grid lines inside the hull region without affecting the perimeter
    // Only draw right and bottom edges to avoid double-drawing shared edges

    // Right edge - draw if there's a hull neighbor to the east
    if (hullTiles.has(`${tileX + 1},${tileY}`)) {
      ctx.beginPath()
      ctx.moveTo(x + zoom + 0.5, y)
      ctx.lineTo(x + zoom + 0.5, y + zoom)
      ctx.stroke()
    }

    // Bottom edge - draw if there's a hull neighbor to the south
    if (hullTiles.has(`${tileX},${tileY + 1}`)) {
      ctx.beginPath()
      ctx.moveTo(x, y + zoom + 0.5)
      ctx.lineTo(x + zoom, y + zoom + 0.5)
      ctx.stroke()
    }
  }

  // 3) Render perimeter walls as edge segments inside hull tiles
  ctx.fillStyle = COLORS.hullWall
  for (const edge of edges) {
    const x = edge.x * zoom
    const y = edge.y * zoom

    switch (edge.direction) {
      case 'north':
        // Top edge strip
        ctx.fillRect(x, y, zoom, wallThickness)
        break
      case 'south':
        // Bottom edge strip
        ctx.fillRect(x, y + zoom - wallThickness, zoom, wallThickness)
        break
      case 'west':
        // Left edge strip
        ctx.fillRect(x, y, wallThickness, zoom)
        break
      case 'east':
        // Right edge strip
        ctx.fillRect(x + zoom - wallThickness, y, wallThickness, zoom)
        break
    }
  }
}

/**
 * Render hull tool preview (single tile ghost)
 */
export function renderHullPreview(rc: RenderContext, preview: HullPreviewInfo): void {
  const { ctx, zoom } = rc

  const x = preview.x * zoom
  const y = preview.y * zoom
  const size = zoom

  // Fill
  ctx.fillStyle = COLORS.hullPreview
  ctx.fillRect(x, y, size, size)

  // Dashed border
  ctx.setLineDash([3, 3])
  ctx.strokeStyle = COLORS.hullPreviewBorder
  ctx.lineWidth = 2
  ctx.strokeRect(x + 1, y + 1, size - 2, size - 2)
  ctx.setLineDash([])
}

/**
 * Render a drag-selection overlay on top of the scene.
 */
export function renderSelectionOverlay(rc: RenderContext, overlay: SelectionOverlay): void {
  const { ctx, zoom } = rc

  const minX = Math.min(overlay.rect.x1, overlay.rect.x2)
  const maxX = Math.max(overlay.rect.x1, overlay.rect.x2)
  const minY = Math.min(overlay.rect.y1, overlay.rect.y2)
  const maxY = Math.max(overlay.rect.y1, overlay.rect.y2)

  const px = minX * zoom
  const py = minY * zoom
  const pw = (maxX - minX + 1) * zoom
  const ph = (maxY - minY + 1) * zoom

  // Base selection fill
  if (overlay.mode === 'hull_place') {
    // Highlight tiles individually for hull placement
    ctx.fillStyle = COLORS.selectionHullPlaceFill
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        ctx.fillRect(x * zoom, y * zoom, zoom, zoom)
      }
    }
  } else if (overlay.mode === 'hull_erase') {
    // Highlight only existing hull tiles (if provided)
    ctx.fillStyle = COLORS.selectionHullEraseFill
    if (overlay.hullTiles) {
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const key = `${x},${y}`
          if (overlay.hullTiles.has(key)) {
            ctx.fillRect(x * zoom, y * zoom, zoom, zoom)
          }
        }
      }
    } else {
      ctx.fillRect(px, py, pw, ph)
    }
  } else {
    // Selection of existing objects (place/erase tools)
    ctx.fillStyle = overlay.mode === 'erase' ? COLORS.selectionEraseFill : COLORS.selectionFill
    ctx.fillRect(px, py, pw, ph)

    // Highlight existing hull tiles inside rect
    if (overlay.hullTiles) {
      ctx.fillStyle =
        overlay.mode === 'erase' ? COLORS.selectionHullEraseFill : COLORS.selectionFill
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const key = `${x},${y}`
          if (overlay.hullTiles.has(key)) {
            ctx.fillRect(x * zoom, y * zoom, zoom, zoom)
          }
        }
      }
    }

    // Highlight selected structures by bounds (size-based)
    if (overlay.structureBounds && overlay.structureBounds.length > 0) {
      ctx.fillStyle = overlay.mode === 'erase' ? COLORS.selectionEraseFill : COLORS.selectionFill
      ctx.strokeStyle =
        overlay.mode === 'erase' ? COLORS.selectionEraseBorder : COLORS.selectionBorder
      ctx.lineWidth = 2
      ctx.setLineDash([4, 2])
      for (const b of overlay.structureBounds) {
        const x = b.x * zoom
        const y = b.y * zoom
        const w = b.width * zoom
        const h = b.height * zoom
        ctx.fillRect(x, y, w, h)
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)
      }
      ctx.setLineDash([])
    }
  }

  // Selection border
  ctx.setLineDash([4, 4])
  ctx.strokeStyle =
    overlay.mode === 'hull_place'
      ? COLORS.hullPreviewBorder
      : overlay.mode === 'hull_erase' || overlay.mode === 'erase'
        ? COLORS.selectionEraseBorder
        : COLORS.selectionBorder
  ctx.lineWidth = 2
  ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2)
  ctx.setLineDash([])
}

/**
 * Render placement preview ghost with tile-level detail
 *
 * Shows:
 * - Construction tiles: structure color (what you're placing)
 * - Blocked tiles: red (areas that will be blocked)
 * - Access tiles: lighter/transparent (areas that remain accessible)
 */
export function renderPreview(rc: RenderContext, preview: PreviewInfo): void {
  const { ctx, zoom } = rc

  // If we have tile layout, render tile-by-tile
  if (preview.tileLayout && preview.tileLayout.tiles.length > 0) {
    const { tiles, width: layoutWidth, height: layoutHeight } = preview.tileLayout

    // Track bounding box of rotated tiles for the outer border
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity

    for (const tile of tiles) {
      // Rotate tile position based on preview rotation
      const rotatedPos = rotateTilePosition(tile, preview.rotation, layoutWidth, layoutHeight)

      // Update bounding box
      minX = Math.min(minX, rotatedPos.x)
      maxX = Math.max(maxX, rotatedPos.x)
      minY = Math.min(minY, rotatedPos.y)
      maxY = Math.max(maxY, rotatedPos.y)

      const tileX = (preview.x + rotatedPos.x) * zoom
      const tileY = (preview.y + rotatedPos.y) * zoom

      // Choose color based on tile type
      if (tile.type === 'construction') {
        // Construction: structure color with preview transparency
        ctx.fillStyle = preview.isValid ? hslToHsla(preview.color, 0.6) : COLORS.previewInvalid
        ctx.fillRect(tileX, tileY, zoom, zoom)

        // Solid border for construction tiles
        ctx.strokeStyle = preview.isValid ? COLORS.previewBorderValid : COLORS.previewBorderInvalid
        ctx.lineWidth = 1
        ctx.strokeRect(tileX + 0.5, tileY + 0.5, zoom - 1, zoom - 1)
      } else if (tile.type === 'blocked') {
        // Blocked: red color (areas that will be blocked)
        ctx.fillStyle = 'rgba(180, 60, 60, 0.5)'
        ctx.fillRect(tileX, tileY, zoom, zoom)

        // Red border for blocked tiles
        ctx.strokeStyle = '#aa4444'
        ctx.lineWidth = 1
        ctx.strokeRect(tileX + 0.5, tileY + 0.5, zoom - 1, zoom - 1)
      } else {
        // Access: lighter transparent (areas that remain accessible)
        ctx.fillStyle = preview.isValid ? hslToHsla(preview.color, 0.2) : 'rgba(255, 68, 68, 0.2)'
        ctx.fillRect(tileX, tileY, zoom, zoom)

        // Dashed border for access tiles
        ctx.setLineDash([2, 2])
        ctx.strokeStyle = preview.isValid ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 68, 68, 0.3)'
        ctx.lineWidth = 1
        ctx.strokeRect(tileX + 0.5, tileY + 0.5, zoom - 1, zoom - 1)
        ctx.setLineDash([])
      }
    }

    // Draw overall dashed border around the entire preview using actual rotated bounds
    const x = (preview.x + minX) * zoom
    const y = (preview.y + minY) * zoom
    const w = (maxX - minX + 1) * zoom
    const h = (maxY - minY + 1) * zoom

    ctx.setLineDash([4, 4])
    ctx.strokeStyle = preview.isValid ? COLORS.previewBorderValid : COLORS.previewBorderInvalid
    ctx.lineWidth = 2
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)
    ctx.setLineDash([])
  } else {
    // Fallback: simple rectangle preview (old behavior)
    const x = preview.x * zoom
    const y = preview.y * zoom
    const w = preview.width * zoom
    const h = preview.height * zoom

    ctx.fillStyle = preview.isValid ? preview.color + '88' : COLORS.previewInvalid
    ctx.fillRect(x, y, w, h)

    ctx.setLineDash([4, 4])
    ctx.strokeStyle = preview.isValid ? COLORS.previewBorderValid : COLORS.previewBorderInvalid
    ctx.lineWidth = 2
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)
    ctx.setLineDash([])
  }
}

/**
 * Get tile coordinates from mouse position
 */
export function getTileFromMouse(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  zoom: number
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  const x = Math.floor((clientX - rect.left) / zoom)
  const y = Math.floor((clientY - rect.top) / zoom)
  return { x, y }
}

/**
 * Render the complete scene
 */
export function renderScene(
  rc: RenderContext,
  structures: readonly PlacedStructure[],
  hullTiles: ReadonlySet<string>,
  catalog: StructureCatalog,
  visibilityState: VisibilityState,
  showGrid: boolean,
  preview: PreviewInfo | null,
  hullPreview: HullPreviewInfo | null
): void {
  clearCanvas(rc)

  if (showGrid) {
    renderGrid(rc)
    renderCenterLines(rc)
  }

  // Render hull tiles first (below structures)
  renderHullTiles(rc, hullTiles)

  renderStructures(rc, structures, catalog, visibilityState)

  if (preview) {
    renderPreview(rc, preview)
  }

  if (hullPreview) {
    renderHullPreview(rc, hullPreview)
  }
}

/**
 * Export canvas to PNG data URL
 */
export function exportToPNG(
  gridSize: GridSize,
  structures: readonly PlacedStructure[],
  hullTiles: ReadonlySet<string>,
  catalog: StructureCatalog,
  visibilityState: VisibilityState,
  scale: number
): string {
  const canvas = document.createElement('canvas')
  canvas.width = gridSize.width * scale
  canvas.height = gridSize.height * scale

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get 2D context for export')
  }

  const rc: RenderContext = {
    canvas,
    ctx,
    gridSize,
    zoom: scale,
    dpr: 1,
  }

  clearCanvas(rc)
  renderGrid(rc)
  renderCenterLines(rc)
  renderHullTiles(rc, hullTiles)
  renderStructures(rc, structures, catalog, visibilityState)

  return canvas.toDataURL('image/png')
}
