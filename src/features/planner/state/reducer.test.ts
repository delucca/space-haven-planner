import { describe, it, expect } from 'vitest'
import { createInitialState, plannerReducer, canPlaceAt, isStructureVisible, isStructureInteractive } from './reducer'
import type { PlannerState } from './types'
import type { StructureCatalog, StructureCategory, StructureDef, LayerId, PlacedStructure } from '@/data/types'

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
        orgLayerId: 'layer-default',
        orgGroupId: null,
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
        orgLayerId: 'layer-default',
        orgGroupId: null,
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
        orgLayerId: 'layer-default',
        orgGroupId: null,
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
        orgLayerId: 'layer-default',
        orgGroupId: null,
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
        orgLayerId: 'layer-default',
        orgGroupId: null,
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
        orgLayerId: 'layer-default',
        orgGroupId: null,
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
        orgLayerId: 'layer-default',
        orgGroupId: null,
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
        orgLayerId: 'layer-default',
        orgGroupId: null,
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
        orgLayerId: 'layer-default',
        orgGroupId: null,
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

// Helper to create a test structure with org IDs
function createTestStructure(overrides: Partial<PlacedStructure> = {}): PlacedStructure {
  return {
    id: 'struct-1',
    structureId: 'test-grow-bed',
    categoryId: 'food',
    x: 5,
    y: 5,
    rotation: 0,
    layer: 'Systems' as LayerId,
    orgLayerId: 'layer-default',
    orgGroupId: null,
    ...overrides,
  }
}

describe('CAD-style Layers and Groups', () => {
  describe('Layer Management', () => {
    it('should create initial state with default user layer', () => {
      const state = createInitialState()
      
      expect(state.userLayers.length).toBe(1)
      expect(state.userLayers.map(l => l.id)).toEqual([
        'layer-default',
      ])
      expect(state.userLayers[0].name).toBe('Default')
      expect(state.userLayers.every(l => l.isVisible)).toBe(true)
      expect(state.userLayers.every(l => !l.isLocked)).toBe(true)
      expect(state.activeLayerId).toBe('layer-default')
    })

    it('should create a new layer', () => {
      let state = createInitialState()
      
      state = plannerReducer(state, {
        type: 'CREATE_LAYER',
        name: 'Custom Layer',
      })

      expect(state.userLayers.length).toBe(2)
      expect(state.userLayers[1].name).toBe('Custom Layer')
      expect(state.userLayers[1].isVisible).toBe(true)
      expect(state.userLayers[1].isLocked).toBe(false)
    })

    it('should rename a layer', () => {
      let state = createInitialState()
      
      state = plannerReducer(state, {
        type: 'RENAME_LAYER',
        layerId: 'layer-default',
        name: 'Renamed Default',
      })

      const defaultLayer = state.userLayers.find(l => l.id === 'layer-default')
      expect(defaultLayer?.name).toBe('Renamed Default')
    })

    it('should toggle layer visibility', () => {
      let state = createInitialState()
      
      // Initially visible
      expect(state.userLayers.find(l => l.id === 'layer-default')?.isVisible).toBe(true)
      
      state = plannerReducer(state, {
        type: 'TOGGLE_LAYER_VISIBLE',
        layerId: 'layer-default',
      })

      expect(state.userLayers.find(l => l.id === 'layer-default')?.isVisible).toBe(false)
      
      // Toggle back
      state = plannerReducer(state, {
        type: 'TOGGLE_LAYER_VISIBLE',
        layerId: 'layer-default',
      })

      expect(state.userLayers.find(l => l.id === 'layer-default')?.isVisible).toBe(true)
    })

    it('should toggle layer lock', () => {
      let state = createInitialState()
      
      // Initially unlocked
      expect(state.userLayers.find(l => l.id === 'layer-default')?.isLocked).toBe(false)
      
      state = plannerReducer(state, {
        type: 'TOGGLE_LAYER_LOCK',
        layerId: 'layer-default',
      })

      expect(state.userLayers.find(l => l.id === 'layer-default')?.isLocked).toBe(true)
    })

    it('should delete layer and all its items', () => {
      const catalog = createTestCatalog()
      let state: PlannerState = {
        ...createInitialState(),
        catalog,
      }

      // Place a structure on the systems layer
      state = plannerReducer(state, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure({ orgLayerId: 'layer-default' }),
      })

      expect(state.structures.length).toBe(1)

      // Delete the systems layer
      state = plannerReducer(state, {
        type: 'DELETE_LAYER_AND_ITEMS',
        layerId: 'layer-default',
      })

      // Layer should be gone
      expect(state.userLayers.find(l => l.id === 'layer-systems')).toBeUndefined()
      // Structure should be gone too
      expect(state.structures.length).toBe(0)
    })
  })

  describe('Group Management', () => {
    it('should create a new group', () => {
      let state = createInitialState()
      
      state = plannerReducer(state, {
        type: 'CREATE_GROUP',
        layerId: 'layer-default',
        name: 'Power Systems',
        categoryId: 'power',
      })

      expect(state.userGroups.length).toBe(1)
      expect(state.userGroups[0].name).toBe('Power Systems')
      expect(state.userGroups[0].layerId).toBe('layer-default')
      expect(state.userGroups[0].categoryId).toBe('power')
    })

    it('should toggle group visibility', () => {
      let state = createInitialState()
      
      // Create a group first
      state = plannerReducer(state, {
        type: 'CREATE_GROUP',
        layerId: 'layer-default',
        name: 'Power Systems',
      })

      const groupId = state.userGroups[0].id
      
      // Initially visible
      expect(state.userGroups[0].isVisible).toBe(true)
      
      state = plannerReducer(state, {
        type: 'TOGGLE_GROUP_VISIBLE',
        groupId,
      })

      expect(state.userGroups.find(g => g.id === groupId)?.isVisible).toBe(false)
    })

    it('should toggle group lock', () => {
      let state = createInitialState()
      
      // Create a group first
      state = plannerReducer(state, {
        type: 'CREATE_GROUP',
        layerId: 'layer-default',
        name: 'Power Systems',
      })

      const groupId = state.userGroups[0].id
      
      // Initially unlocked
      expect(state.userGroups[0].isLocked).toBe(false)
      
      state = plannerReducer(state, {
        type: 'TOGGLE_GROUP_LOCK',
        groupId,
      })

      expect(state.userGroups.find(g => g.id === groupId)?.isLocked).toBe(true)
    })

    it('should delete group and all its items', () => {
      const catalog = createTestCatalog()
      let state: PlannerState = {
        ...createInitialState(),
        catalog,
      }

      // Create a group
      state = plannerReducer(state, {
        type: 'CREATE_GROUP',
        layerId: 'layer-default',
        name: 'Power Systems',
      })

      const groupId = state.userGroups[0].id

      // Place a structure in the group
      state = plannerReducer(state, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure({ orgLayerId: 'layer-default', orgGroupId: groupId }),
      })

      expect(state.structures.length).toBe(1)

      // Delete the group
      state = plannerReducer(state, {
        type: 'DELETE_GROUP_AND_ITEMS',
        groupId,
      })

      // Group should be gone
      expect(state.userGroups.find(g => g.id === groupId)).toBeUndefined()
      // Structure should be gone too
      expect(state.structures.length).toBe(0)
    })
  })

  describe('Visibility and Interactivity', () => {
    it('should mark structure as visible when layer is visible', () => {
      const state = createInitialState()
      const struct = createTestStructure({ orgLayerId: 'layer-default' })
      
      expect(isStructureVisible(state, struct)).toBe(true)
    })

    it('should mark structure as hidden when layer is hidden', () => {
      let state = createInitialState()
      
      state = plannerReducer(state, {
        type: 'TOGGLE_LAYER_VISIBLE',
        layerId: 'layer-default',
      })

      const struct = createTestStructure({ orgLayerId: 'layer-default' })
      
      expect(isStructureVisible(state, struct)).toBe(false)
    })

    it('should mark structure as hidden when group is hidden', () => {
      let state = createInitialState()
      
      // Create a group
      state = plannerReducer(state, {
        type: 'CREATE_GROUP',
        layerId: 'layer-default',
        name: 'Power Systems',
      })

      const groupId = state.userGroups[0].id

      // Hide the group
      state = plannerReducer(state, {
        type: 'TOGGLE_GROUP_VISIBLE',
        groupId,
      })

      const struct = createTestStructure({ orgLayerId: 'layer-default', orgGroupId: groupId })
      
      expect(isStructureVisible(state, struct)).toBe(false)
    })

    it('should mark structure as interactive when layer is visible and unlocked', () => {
      const state = createInitialState()
      const struct = createTestStructure({ orgLayerId: 'layer-default' })
      
      expect(isStructureInteractive(state, struct)).toBe(true)
    })

    it('should mark structure as non-interactive when layer is locked', () => {
      let state = createInitialState()
      
      state = plannerReducer(state, {
        type: 'TOGGLE_LAYER_LOCK',
        layerId: 'layer-default',
      })

      const struct = createTestStructure({ orgLayerId: 'layer-default' })
      
      expect(isStructureInteractive(state, struct)).toBe(false)
    })

    it('should mark structure as non-interactive when group is locked', () => {
      let state = createInitialState()
      
      // Create a group
      state = plannerReducer(state, {
        type: 'CREATE_GROUP',
        layerId: 'layer-default',
        name: 'Power Systems',
      })

      const groupId = state.userGroups[0].id

      // Lock the group
      state = plannerReducer(state, {
        type: 'TOGGLE_GROUP_LOCK',
        groupId,
      })

      const struct = createTestStructure({ orgLayerId: 'layer-default', orgGroupId: groupId })
      
      expect(isStructureInteractive(state, struct)).toBe(false)
    })

    it('should not erase hidden structures', () => {
      const catalog = createTestCatalog()
      let state: PlannerState = {
        ...createInitialState(),
        catalog,
      }

      // Place a structure
      state = plannerReducer(state, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure({ orgLayerId: 'layer-default' }),
      })

      expect(state.structures.length).toBe(1)

      // Hide the layer
      state = plannerReducer(state, {
        type: 'TOGGLE_LAYER_VISIBLE',
        layerId: 'layer-default',
      })

      // Try to erase at the structure's position
      state = plannerReducer(state, {
        type: 'ERASE_AT',
        x: 5,
        y: 5,
      })

      // Structure should still exist (hidden structures can't be erased)
      expect(state.structures.length).toBe(1)
    })

    it('should not erase locked structures', () => {
      const catalog = createTestCatalog()
      let state: PlannerState = {
        ...createInitialState(),
        catalog,
      }

      // Place a structure
      state = plannerReducer(state, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure({ orgLayerId: 'layer-default' }),
      })

      expect(state.structures.length).toBe(1)

      // Lock the layer
      state = plannerReducer(state, {
        type: 'TOGGLE_LAYER_LOCK',
        layerId: 'layer-default',
      })

      // Try to erase at the structure's position
      state = plannerReducer(state, {
        type: 'ERASE_AT',
        x: 5,
        y: 5,
      })

      // Structure should still exist (locked structures can't be erased)
      expect(state.structures.length).toBe(1)
    })

    it('should not erase hidden structures in rect erase', () => {
      const catalog = createTestCatalog()
      let state: PlannerState = {
        ...createInitialState(),
        catalog,
      }

      // Place a structure
      state = plannerReducer(state, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure({ orgLayerId: 'layer-default' }),
      })

      expect(state.structures.length).toBe(1)

      // Hide the layer
      state = plannerReducer(state, {
        type: 'TOGGLE_LAYER_VISIBLE',
        layerId: 'layer-default',
      })

      // Try to erase in a rect that covers the structure
      state = plannerReducer(state, {
        type: 'ERASE_IN_RECT',
        x1: 0,
        y1: 0,
        x2: 20,
        y2: 20,
      })

      // Structure should still exist (hidden structures can't be erased)
      expect(state.structures.length).toBe(1)
    })
  })

  describe('Structure Organization', () => {
    it('should move structure to a different group', () => {
      const catalog = createTestCatalog()
      let state: PlannerState = {
        ...createInitialState(),
        catalog,
      }

      // Create two groups
      state = plannerReducer(state, {
        type: 'CREATE_GROUP',
        layerId: 'layer-default',
        name: 'Group A',
      })
      const groupAId = state.userGroups[0].id

      state = plannerReducer(state, {
        type: 'CREATE_GROUP',
        layerId: 'layer-default',
        name: 'Group B',
      })
      const groupBId = state.userGroups[1].id

      // Place a structure in Group A
      state = plannerReducer(state, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure({ orgLayerId: 'layer-default', orgGroupId: groupAId }),
      })

      expect(state.structures[0].orgGroupId).toBe(groupAId)

      // Move to Group B
      state = plannerReducer(state, {
        type: 'MOVE_STRUCTURE_TO_GROUP',
        structureId: state.structures[0].id,
        layerId: 'layer-default',
        groupId: groupBId,
      })

      expect(state.structures[0].orgGroupId).toBe(groupBId)
    })

    it('should delete individual structure', () => {
      const catalog = createTestCatalog()
      let state: PlannerState = {
        ...createInitialState(),
        catalog,
      }

      // Place a structure
      state = plannerReducer(state, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure(),
      })

      const structId = state.structures[0].id
      expect(state.structures.length).toBe(1)

      // Delete the structure
      state = plannerReducer(state, {
        type: 'DELETE_STRUCTURE',
        structureId: structId,
      })

      expect(state.structures.length).toBe(0)
    })
  })
})
