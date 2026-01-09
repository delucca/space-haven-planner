import type { GridSize, PlacedStructure, StructureCatalog } from '@/data/types'
import { findStructureById, getRotatedSize } from '@/data'

/** Colors for rendering */
const COLORS = {
  background: '#1a1e24',
  gridLine: '#2a3040',
  previewValid: 'rgba(136, 255, 136, 0.5)',
  previewInvalid: 'rgba(255, 68, 68, 0.4)',
  previewBorderValid: '#88ff88',
  previewBorderInvalid: '#ff4444',
  structureBorder: 'rgba(255, 255, 255, 0.2)',
  structureText: '#ffffff',
  structureTextShadow: '#000000',
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
 * Render a single placed structure
 */
export function renderStructure(
  rc: RenderContext,
  structure: PlacedStructure,
  catalog: StructureCatalog
): void {
  const found = findStructureById(catalog, structure.structureId)
  if (!found) return

  const { ctx, zoom } = rc
  const [width, height] = getRotatedSize(found.structure.size, structure.rotation)

  const x = structure.x * zoom
  const y = structure.y * zoom
  const w = width * zoom
  const h = height * zoom

  // Fill
  ctx.fillStyle = found.structure.color
  ctx.fillRect(x, y, w, h)

  // Border
  ctx.strokeStyle = COLORS.structureBorder
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)

  // Label (only if zoom is large enough)
  if (zoom >= 10) {
    const fontSize = Math.min(zoom * 0.6, 10)
    ctx.font = `${fontSize}px monospace`
    ctx.fillStyle = COLORS.structureText
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = COLORS.structureTextShadow
    ctx.shadowBlur = 2
    ctx.shadowOffsetX = 1
    ctx.shadowOffsetY = 1

    const text = found.structure.name
    const maxChars = Math.floor((w - 4) / (fontSize * 0.6))
    const displayText = text.length > maxChars ? text.substring(0, maxChars) : text

    ctx.fillText(displayText, x + w / 2, y + h / 2)

    // Reset shadow
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
  }
}

/**
 * Render all placed structures
 */
export function renderStructures(
  rc: RenderContext,
  structures: readonly PlacedStructure[],
  catalog: StructureCatalog,
  visibleLayers: ReadonlySet<string>
): void {
  for (const structure of structures) {
    if (visibleLayers.has(structure.layer)) {
      renderStructure(rc, structure, catalog)
    }
  }
}

/**
 * Render placement preview ghost
 */
export function renderPreview(rc: RenderContext, preview: PreviewInfo): void {
  const { ctx, zoom } = rc

  const x = preview.x * zoom
  const y = preview.y * zoom
  const w = preview.width * zoom
  const h = preview.height * zoom

  // Fill
  ctx.fillStyle = preview.isValid ? preview.color + '88' : COLORS.previewInvalid
  ctx.fillRect(x, y, w, h)

  // Dashed border
  ctx.setLineDash([4, 4])
  ctx.strokeStyle = preview.isValid ? COLORS.previewBorderValid : COLORS.previewBorderInvalid
  ctx.lineWidth = 2
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)
  ctx.setLineDash([])
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
  catalog: StructureCatalog,
  visibleLayers: ReadonlySet<string>,
  showGrid: boolean,
  preview: PreviewInfo | null
): void {
  clearCanvas(rc)

  if (showGrid) {
    renderGrid(rc)
  }

  renderStructures(rc, structures, catalog, visibleLayers)

  if (preview) {
    renderPreview(rc, preview)
  }
}

/**
 * Export canvas to PNG data URL
 */
export function exportToPNG(
  gridSize: GridSize,
  structures: readonly PlacedStructure[],
  catalog: StructureCatalog,
  visibleLayers: ReadonlySet<string>,
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
  renderStructures(rc, structures, catalog, visibleLayers)

  return canvas.toDataURL('image/png')
}
