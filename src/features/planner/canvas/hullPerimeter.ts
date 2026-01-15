/**
 * Hull perimeter edge computation
 *
 * Computes the perimeter edges of a hull region using 4-neighbor (cardinal) adjacency.
 * Used for rendering hull walls as edge segments instead of full wall tiles.
 */

/** Edge direction for hull perimeter */
export type EdgeDirection = 'north' | 'south' | 'east' | 'west'

/** A single perimeter edge segment */
export interface PerimeterEdge {
  /** Tile X coordinate */
  x: number
  /** Tile Y coordinate */
  y: number
  /** Edge direction (which side of the tile the edge is on) */
  direction: EdgeDirection
}

/**
 * Compute perimeter edges for a set of hull tiles.
 *
 * For each hull tile, checks the 4 cardinal neighbors (N/E/S/W).
 * If a neighbor is NOT a hull tile, that side is a perimeter edge.
 *
 * @param hullTiles - Set of hull tile keys in "x,y" format
 * @returns Array of perimeter edges
 */
export function computePerimeterEdges(hullTiles: ReadonlySet<string>): PerimeterEdge[] {
  const edges: PerimeterEdge[] = []

  for (const key of hullTiles) {
    const [xStr, yStr] = key.split(',')
    const x = parseInt(xStr, 10)
    const y = parseInt(yStr, 10)

    // Check north neighbor (y - 1)
    if (!hullTiles.has(`${x},${y - 1}`)) {
      edges.push({ x, y, direction: 'north' })
    }

    // Check south neighbor (y + 1)
    if (!hullTiles.has(`${x},${y + 1}`)) {
      edges.push({ x, y, direction: 'south' })
    }

    // Check west neighbor (x - 1)
    if (!hullTiles.has(`${x - 1},${y}`)) {
      edges.push({ x, y, direction: 'west' })
    }

    // Check east neighbor (x + 1)
    if (!hullTiles.has(`${x + 1},${y}`)) {
      edges.push({ x, y, direction: 'east' })
    }
  }

  return edges
}

/**
 * Check if a hull tile is fully surrounded by other hull tiles (4-neighbor).
 * Used to determine if a tile should use the "inner" hull color.
 *
 * @param hullTiles - Set of hull tile keys in "x,y" format
 * @param x - Tile X coordinate
 * @param y - Tile Y coordinate
 * @returns true if all 4 cardinal neighbors are hull tiles
 */
export function isInnerHullTile(hullTiles: ReadonlySet<string>, x: number, y: number): boolean {
  return (
    hullTiles.has(`${x},${y - 1}`) && // north
    hullTiles.has(`${x},${y + 1}`) && // south
    hullTiles.has(`${x - 1},${y}`) && // west
    hullTiles.has(`${x + 1},${y}`) // east
  )
}

