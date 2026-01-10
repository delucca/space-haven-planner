import { describe, it, expect } from 'vitest'
import { createInitialState, plannerReducer, canPlaceAt } from './reducer'
import type { PlannerState } from './types'
import type { StructureCatalog, StructureCategory, StructureDef, LayerId } from '@/data/types'

// Create a minimal test catalog with a structure that has tile layout
function createTestCatalog(): StructureCatalog {
  const testStructure: StructureDef = {
    id: 'test-grow-bed',
    name: 'Test Grow Bed',
    size: [3, 1] as const,
    color: 'hsl(96, 57%, 50%)',
    categoryId: 'food',
    tileLayout: {
      tiles: [
        { x: 0, y: 0, type: 'construction', walkCost: 1 },
        { x: 1, y: 0, type: 'construction', walkCost: 1 },
        { x: 2, y: 0, type: 'construction', walkCost: 1 },
        { x: 0, y: -1, type: 'access', walkCost: 0 },
        { x: 1, y: -1, type: 'access', walkCost: 0 },
        { x: 2, y: -1, type: 'access', walkCost: 0 },
      ],
      width: 3,
      height: 2,
    },
  }

  const testCategory: StructureCategory = {
    id: 'food',
    name: 'Food',
    defaultLayer: 'Systems' as LayerId,
    color: 'hsl(96, 57%, 50%)',
    items: [testStructure],
  }

  return {
    categories: [testCategory],
  }
}

describe('Collision Detection', () => {
  it('should prevent placing structures on top of each other', () => {
    const catalog = createTestCatalog()
    let state: PlannerState = {
      ...createInitialState(),
      catalog,
    }

    // Place first structure at (5, 5)
    state = plannerReducer(state, {
      type: 'PLACE_STRUCTURE',
      structure: {
        id: 'struct-1',
        structureId: 'test-grow-bed',
        categoryId: 'food',
        x: 5,
        y: 5,
        rotation: 0,
        layer: 'Systems' as LayerId,
      },
    })

    expect(state.structures.length).toBe(1)
    expect(state.structures[0].x).toBe(5)
    expect(state.structures[0].y).toBe(5)

    // Try to place second structure at same position - should be rejected
    state = plannerReducer(state, {
      type: 'PLACE_STRUCTURE',
      structure: {
        id: 'struct-2',
        structureId: 'test-grow-bed',
        categoryId: 'food',
        x: 5,
        y: 5,
        rotation: 0,
        layer: 'Systems' as LayerId,
      },
    })

    // Should still only have 1 structure
    expect(state.structures.length).toBe(1)
  })

  it('should prevent placing structures with overlapping construction tiles', () => {
    const catalog = createTestCatalog()
    let state: PlannerState = {
      ...createInitialState(),
      catalog,
    }

    // Place first structure at (5, 5)
    state = plannerReducer(state, {
      type: 'PLACE_STRUCTURE',
      structure: {
        id: 'struct-1',
        structureId: 'test-grow-bed',
        categoryId: 'food',
        x: 5,
        y: 5,
        rotation: 0,
        layer: 'Systems' as LayerId,
      },
    })

    expect(state.structures.length).toBe(1)

    // Try to place second structure at (6, 5) - overlaps on tiles (6,5) and (7,5)
    state = plannerReducer(state, {
      type: 'PLACE_STRUCTURE',
      structure: {
        id: 'struct-2',
        structureId: 'test-grow-bed',
        categoryId: 'food',
        x: 6,
        y: 5,
        rotation: 0,
        layer: 'Systems' as LayerId,
      },
    })

    // Should still only have 1 structure (collision detected)
    expect(state.structures.length).toBe(1)
  })

  it('should allow placing structures with only access-to-access tile overlap', () => {
    const catalog = createTestCatalog()
    let state: PlannerState = {
      ...createInitialState(),
      catalog,
    }

    // Place first structure at (5, 5)
    // Construction tiles: (5,5), (6,5), (7,5)
    // Access tiles: (5,4), (6,4), (7,4)
    state = plannerReducer(state, {
      type: 'PLACE_STRUCTURE',
      structure: {
        id: 'struct-1',
        structureId: 'test-grow-bed',
        categoryId: 'food',
        x: 5,
        y: 5,
        rotation: 0,
        layer: 'Systems' as LayerId,
      },
    })

    expect(state.structures.length).toBe(1)

    // Place second structure at (5, 3)
    // Construction tiles: (5,3), (6,3), (7,3)
    // Access tiles: (5,2), (6,2), (7,2)
    // First structure's access tiles are at y=4, second's construction at y=3
    // No overlap at all - should be allowed
    state = plannerReducer(state, {
      type: 'PLACE_STRUCTURE',
      structure: {
        id: 'struct-2',
        structureId: 'test-grow-bed',
        categoryId: 'food',
        x: 5,
        y: 3,
        rotation: 0,
        layer: 'Systems' as LayerId,
      },
    })

    // Should have 2 structures (no overlap)
    expect(state.structures.length).toBe(2)
  })

  it('should prevent placing construction tiles over access tiles', () => {
    const catalog = createTestCatalog()
    let state: PlannerState = {
      ...createInitialState(),
      catalog,
    }

    // Place first structure at (5, 5)
    // Construction tiles: (5,5), (6,5), (7,5)
    // Access tiles: (5,4), (6,4), (7,4)
    state = plannerReducer(state, {
      type: 'PLACE_STRUCTURE',
      structure: {
        id: 'struct-1',
        structureId: 'test-grow-bed',
        categoryId: 'food',
        x: 5,
        y: 5,
        rotation: 0,
        layer: 'Systems' as LayerId,
      },
    })

    expect(state.structures.length).toBe(1)

    // Try to place second structure at (5, 4)
    // Construction tiles would be at: (5,4), (6,4), (7,4)
    // This overlaps with first structure's ACCESS tiles - should be BLOCKED
    state = plannerReducer(state, {
      type: 'PLACE_STRUCTURE',
      structure: {
        id: 'struct-2',
        structureId: 'test-grow-bed',
        categoryId: 'food',
        x: 5,
        y: 4,
        rotation: 0,
        layer: 'Systems' as LayerId,
      },
    })

    // Should still only have 1 structure (construction over access is blocked)
    expect(state.structures.length).toBe(1)
  })

  it('canPlaceAt should return false for any tile overlap except access-to-access', () => {
    const catalog = createTestCatalog()
    let state: PlannerState = {
      ...createInitialState(),
      catalog,
    }

    // Place first structure at (5, 5)
    // Construction tiles: (5,5), (6,5), (7,5)
    // Access tiles: (5,4), (6,4), (7,4)
    state = plannerReducer(state, {
      type: 'PLACE_STRUCTURE',
      structure: {
        id: 'struct-1',
        structureId: 'test-grow-bed',
        categoryId: 'food',
        x: 5,
        y: 5,
        rotation: 0,
        layer: 'Systems' as LayerId,
      },
    })

    // canPlaceAt should return false for same position (construction overlap)
    expect(canPlaceAt(state, 'test-grow-bed', 5, 5, 0)).toBe(false)

    // canPlaceAt should return false for overlapping construction tiles
    expect(canPlaceAt(state, 'test-grow-bed', 6, 5, 0)).toBe(false)

    // canPlaceAt should return false when new construction overlaps existing access
    // At (5, 4), new construction tiles would be at (5,4), (6,4), (7,4)
    // which are exactly where existing access tiles are
    expect(canPlaceAt(state, 'test-grow-bed', 5, 4, 0)).toBe(false)

    // canPlaceAt should return true for completely non-overlapping position
    expect(canPlaceAt(state, 'test-grow-bed', 5, 2, 0)).toBe(true)
  })
})

