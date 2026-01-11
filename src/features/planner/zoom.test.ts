import { describe, it, expect } from 'vitest'
import { calculateFitZoomForViewport } from './zoom'

describe('calculateFitZoomForViewport', () => {
  // Note: Canvas border is 4px (2px on each side), accounted for in the function

  it('returns 1 for invalid gridWidth (zero)', () => {
    expect(calculateFitZoomForViewport(0, 1000)).toBe(1)
  })

  it('returns 1 for invalid gridWidth (negative)', () => {
    expect(calculateFitZoomForViewport(-10, 1000)).toBe(1)
  })

  it('returns 1 for invalid availableWidth (zero)', () => {
    expect(calculateFitZoomForViewport(54, 0)).toBe(1)
  })

  it('returns 1 for invalid availableWidth (negative)', () => {
    expect(calculateFitZoomForViewport(54, -100)).toBe(1)
  })

  it('returns 1 for non-finite gridWidth', () => {
    expect(calculateFitZoomForViewport(NaN, 1000)).toBe(1)
    expect(calculateFitZoomForViewport(Infinity, 1000)).toBe(1)
  })

  it('returns 1 for non-finite availableWidth', () => {
    expect(calculateFitZoomForViewport(54, NaN)).toBe(1)
    expect(calculateFitZoomForViewport(54, Infinity)).toBe(1)
  })

  it('calculates correct zoom for typical canvas width', () => {
    // With 1000px available and 54 tile grid width
    // Usable = 1000 - 4 (border) = 996
    // Zoom = floor(996 / 54) = floor(18.44) = 18
    expect(calculateFitZoomForViewport(54, 1000)).toBe(18)
  })

  it('calculates correct zoom for small canvas width', () => {
    // With 500px available and 54 tile grid width
    // Usable = 500 - 4 = 496
    // Zoom = floor(496 / 54) = floor(9.18) = 9
    expect(calculateFitZoomForViewport(54, 500)).toBe(9)
  })

  it('calculates correct zoom for large canvas width', () => {
    // With 2000px available and 54 tile grid width
    // Usable = 2000 - 4 = 1996
    // Zoom = floor(1996 / 54) = floor(36.96) = 36
    expect(calculateFitZoomForViewport(54, 2000)).toBe(36)
  })

  it('calculates correct zoom for different grid widths', () => {
    // 2x2 preset: 54 tiles wide
    expect(calculateFitZoomForViewport(54, 1000)).toBe(18)

    // 3x2 preset: 81 tiles wide
    // Usable = 1000 - 4 = 996
    // Zoom = floor(996 / 81) = floor(12.29) = 12
    expect(calculateFitZoomForViewport(81, 1000)).toBe(12)

    // 3x3 preset: 81 tiles wide (same width as 3x2)
    expect(calculateFitZoomForViewport(81, 1000)).toBe(12)
  })

  it('returns minimum of 1 when canvas is too small', () => {
    // With only 50px available and 54 tile grid width
    // Usable = 50 - 4 = 46
    // Zoom = floor(46 / 54) = 0, but clamped to 1
    expect(calculateFitZoomForViewport(54, 50)).toBe(1)
  })

  it('handles exact fit scenarios', () => {
    // If usable width exactly divides by grid width
    // 540px available, 54 tiles: usable = 536, zoom = floor(536/54) = 9
    expect(calculateFitZoomForViewport(54, 540)).toBe(9)
  })

  it('zoom changes when canvas width changes (sidebar resize simulation)', () => {
    const gridWidth = 54

    // Full width (both sidebars visible)
    const fullWidthZoom = calculateFitZoomForViewport(gridWidth, 800)

    // More width (one sidebar collapsed)
    const moreWidthZoom = calculateFitZoomForViewport(gridWidth, 1100)

    // Even more width (both sidebars collapsed)
    const maxWidthZoom = calculateFitZoomForViewport(gridWidth, 1400)

    // Zoom should increase as available width increases
    expect(moreWidthZoom).toBeGreaterThan(fullWidthZoom)
    expect(maxWidthZoom).toBeGreaterThan(moreWidthZoom)
  })
})
