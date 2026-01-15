import { describe, it, expect } from 'vitest'
import { computePerimeterEdges, isInnerHullTile, type PerimeterEdge } from './hullPerimeter'

/**
 * Helper to create a Set of hull tile keys from an array of [x, y] coordinates
 */
function makeHullSet(coords: [number, number][]): Set<string> {
  return new Set(coords.map(([x, y]) => `${x},${y}`))
}

/**
 * Helper to sort edges for consistent comparison
 */
function sortEdges(edges: PerimeterEdge[]): PerimeterEdge[] {
  return [...edges].sort((a, b) => {
    if (a.x !== b.x) return a.x - b.x
    if (a.y !== b.y) return a.y - b.y
    return a.direction.localeCompare(b.direction)
  })
}

describe('computePerimeterEdges', () => {
  it('returns 4 edges for a single tile', () => {
    const hullTiles = makeHullSet([[5, 5]])
    const edges = computePerimeterEdges(hullTiles)

    expect(edges).toHaveLength(4)

    const sorted = sortEdges(edges)
    expect(sorted).toEqual([
      { x: 5, y: 5, direction: 'east' },
      { x: 5, y: 5, direction: 'north' },
      { x: 5, y: 5, direction: 'south' },
      { x: 5, y: 5, direction: 'west' },
    ])
  })

  it('returns 6 edges for two horizontally adjacent tiles (no internal shared edge)', () => {
    // Two tiles side by side: (0,0) and (1,0)
    const hullTiles = makeHullSet([
      [0, 0],
      [1, 0],
    ])
    const edges = computePerimeterEdges(hullTiles)

    // Each tile has 4 potential edges, but the shared edge (east of 0,0 and west of 1,0)
    // should NOT appear because those neighbors ARE hull tiles
    // Expected: 6 edges total (2 north, 2 south, 1 west, 1 east)
    expect(edges).toHaveLength(6)

    const sorted = sortEdges(edges)
    expect(sorted).toEqual([
      { x: 0, y: 0, direction: 'north' },
      { x: 0, y: 0, direction: 'south' },
      { x: 0, y: 0, direction: 'west' },
      { x: 1, y: 0, direction: 'east' },
      { x: 1, y: 0, direction: 'north' },
      { x: 1, y: 0, direction: 'south' },
    ])
  })

  it('returns 6 edges for two vertically adjacent tiles', () => {
    // Two tiles stacked: (0,0) and (0,1)
    const hullTiles = makeHullSet([
      [0, 0],
      [0, 1],
    ])
    const edges = computePerimeterEdges(hullTiles)

    // Expected: 6 edges total (2 west, 2 east, 1 north, 1 south)
    expect(edges).toHaveLength(6)

    const sorted = sortEdges(edges)
    expect(sorted).toEqual([
      { x: 0, y: 0, direction: 'east' },
      { x: 0, y: 0, direction: 'north' },
      { x: 0, y: 0, direction: 'west' },
      { x: 0, y: 1, direction: 'east' },
      { x: 0, y: 1, direction: 'south' },
      { x: 0, y: 1, direction: 'west' },
    ])
  })

  it('returns 8 perimeter edges for a 2x2 block', () => {
    // 2x2 block:
    // (0,0) (1,0)
    // (0,1) (1,1)
    const hullTiles = makeHullSet([
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ])
    const edges = computePerimeterEdges(hullTiles)

    // Perimeter only: 2 north, 2 south, 2 west, 2 east = 8 edges
    expect(edges).toHaveLength(8)

    const sorted = sortEdges(edges)
    expect(sorted).toEqual([
      { x: 0, y: 0, direction: 'north' },
      { x: 0, y: 0, direction: 'west' },
      { x: 0, y: 1, direction: 'south' },
      { x: 0, y: 1, direction: 'west' },
      { x: 1, y: 0, direction: 'east' },
      { x: 1, y: 0, direction: 'north' },
      { x: 1, y: 1, direction: 'east' },
      { x: 1, y: 1, direction: 'south' },
    ])
  })

  it('handles L-shape with correct concave perimeter', () => {
    // L-shape:
    // (0,0) (1,0)
    // (0,1)
    const hullTiles = makeHullSet([
      [0, 0],
      [1, 0],
      [0, 1],
    ])
    const edges = computePerimeterEdges(hullTiles)

    // L-shape has 10 perimeter edges:
    // (0,0): north, west (east and south are hull neighbors)
    // (1,0): north, east, south (west is hull neighbor)
    // (0,1): west, south, east (north is hull neighbor)
    expect(edges).toHaveLength(8)

    const sorted = sortEdges(edges)
    expect(sorted).toEqual([
      { x: 0, y: 0, direction: 'north' },
      { x: 0, y: 0, direction: 'west' },
      { x: 0, y: 1, direction: 'east' },
      { x: 0, y: 1, direction: 'south' },
      { x: 0, y: 1, direction: 'west' },
      { x: 1, y: 0, direction: 'east' },
      { x: 1, y: 0, direction: 'north' },
      { x: 1, y: 0, direction: 'south' },
    ])
  })

  it('returns empty array for empty hull set', () => {
    const hullTiles = makeHullSet([])
    const edges = computePerimeterEdges(hullTiles)
    expect(edges).toHaveLength(0)
  })

  it('handles negative coordinates correctly', () => {
    const hullTiles = makeHullSet([[-1, -1]])
    const edges = computePerimeterEdges(hullTiles)

    expect(edges).toHaveLength(4)
    expect(edges).toContainEqual({ x: -1, y: -1, direction: 'north' })
    expect(edges).toContainEqual({ x: -1, y: -1, direction: 'south' })
    expect(edges).toContainEqual({ x: -1, y: -1, direction: 'east' })
    expect(edges).toContainEqual({ x: -1, y: -1, direction: 'west' })
  })
})

describe('isInnerHullTile', () => {
  it('returns false for a single tile (no neighbors)', () => {
    const hullTiles = makeHullSet([[5, 5]])
    expect(isInnerHullTile(hullTiles, 5, 5)).toBe(false)
  })

  it('returns false for edge tiles in a 2x2 block', () => {
    // 2x2 block - no tile is fully surrounded
    const hullTiles = makeHullSet([
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ])

    expect(isInnerHullTile(hullTiles, 0, 0)).toBe(false)
    expect(isInnerHullTile(hullTiles, 1, 0)).toBe(false)
    expect(isInnerHullTile(hullTiles, 0, 1)).toBe(false)
    expect(isInnerHullTile(hullTiles, 1, 1)).toBe(false)
  })

  it('returns true for center tile in a 3x3 block', () => {
    // 3x3 block - only center tile (1,1) is fully surrounded
    const hullTiles = makeHullSet([
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ])

    // Center tile is fully surrounded
    expect(isInnerHullTile(hullTiles, 1, 1)).toBe(true)

    // Edge and corner tiles are not
    expect(isInnerHullTile(hullTiles, 0, 0)).toBe(false)
    expect(isInnerHullTile(hullTiles, 1, 0)).toBe(false)
    expect(isInnerHullTile(hullTiles, 2, 0)).toBe(false)
    expect(isInnerHullTile(hullTiles, 0, 1)).toBe(false)
    expect(isInnerHullTile(hullTiles, 2, 1)).toBe(false)
    expect(isInnerHullTile(hullTiles, 0, 2)).toBe(false)
    expect(isInnerHullTile(hullTiles, 1, 2)).toBe(false)
    expect(isInnerHullTile(hullTiles, 2, 2)).toBe(false)
  })

  it('returns true for cross-pattern center', () => {
    // Cross pattern - center tile (1,1) is surrounded by 4 cardinal neighbors
    // but no diagonal neighbors (which shouldn't matter for 4-neighbor check)
    const hullTiles = makeHullSet([
      [1, 0], // north
      [0, 1], // west
      [1, 1], // center
      [2, 1], // east
      [1, 2], // south
    ])

    expect(isInnerHullTile(hullTiles, 1, 1)).toBe(true)
    expect(isInnerHullTile(hullTiles, 1, 0)).toBe(false) // north arm
    expect(isInnerHullTile(hullTiles, 0, 1)).toBe(false) // west arm
    expect(isInnerHullTile(hullTiles, 2, 1)).toBe(false) // east arm
    expect(isInnerHullTile(hullTiles, 1, 2)).toBe(false) // south arm
  })

  it('returns false for tile not in hull set', () => {
    const hullTiles = makeHullSet([[0, 0]])
    // Querying a tile that doesn't exist in the set
    expect(isInnerHullTile(hullTiles, 5, 5)).toBe(false)
  })
})

