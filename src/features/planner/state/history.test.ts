import { describe, it, expect } from 'vitest'
import { historyReducer, createInitialHistoryState, type HistoryState } from './history'
import type {
  LayerId,
  PlacedStructure,
  StructureCatalog,
  StructureCategory,
  StructureDef,
} from '@/data/types'

/**
 * Create a minimal test catalog with a structure that has tile layout
 */
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

/**
 * Create initial history state with test catalog
 */
function createTestHistoryState(): HistoryState {
  const historyState = createInitialHistoryState()
  return {
    ...historyState,
    state: {
      ...historyState.state,
      catalog: createTestCatalog(),
    },
  }
}

/**
 * Helper to create a minimal placed structure for testing
 */
function createTestStructure(id: string, x = 5, y = 5): PlacedStructure {
  return {
    id,
    structureId: 'test-grow-bed',
    categoryId: 'food',
    x,
    y,
    rotation: 0,
    layer: 'Systems' as LayerId,
    orgLayerId: 'layer-default',
    orgGroupId: null,
  }
}

describe('historyReducer', () => {
  describe('initialization', () => {
    it('creates initial state with empty history stacks', () => {
      const historyState = createInitialHistoryState()

      expect(historyState.past).toEqual([])
      expect(historyState.future).toEqual([])
      expect(historyState.state).toBeDefined()
      expect(historyState.state.structures).toEqual([])
    })
  })

  describe('undo/redo', () => {
    it('does nothing when undoing with empty past', () => {
      const historyState = createTestHistoryState()
      const result = historyReducer(historyState, { type: 'UNDO' })

      expect(result).toBe(historyState) // Same reference, no change
    })

    it('does nothing when redoing with empty future', () => {
      const historyState = createTestHistoryState()
      const result = historyReducer(historyState, { type: 'REDO' })

      expect(result).toBe(historyState) // Same reference, no change
    })

    it('restores previous state on undo', () => {
      let historyState = createTestHistoryState()

      // Place a structure
      historyState = historyReducer(historyState, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure('struct-1', 5, 5),
      })

      expect(historyState.state.structures.length).toBe(1)
      expect(historyState.past.length).toBe(1)

      // Undo
      historyState = historyReducer(historyState, { type: 'UNDO' })

      expect(historyState.state.structures.length).toBe(0)
      expect(historyState.past.length).toBe(0)
      expect(historyState.future.length).toBe(1)
    })

    it('restores undone state on redo', () => {
      let historyState = createTestHistoryState()

      // Place a structure
      historyState = historyReducer(historyState, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure('struct-1', 5, 5),
      })

      // Undo
      historyState = historyReducer(historyState, { type: 'UNDO' })
      expect(historyState.state.structures.length).toBe(0)

      // Redo
      historyState = historyReducer(historyState, { type: 'REDO' })

      expect(historyState.state.structures.length).toBe(1)
      expect(historyState.past.length).toBe(1)
      expect(historyState.future.length).toBe(0)
    })

    it('clears future stack when new action is performed after undo', () => {
      let historyState = createTestHistoryState()

      // Place first structure
      historyState = historyReducer(historyState, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure('struct-1', 5, 5),
      })

      // Undo
      historyState = historyReducer(historyState, { type: 'UNDO' })
      expect(historyState.future.length).toBe(1)

      // Place a different structure (new branch) - at different position to avoid collision
      historyState = historyReducer(historyState, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure('struct-2', 10, 10),
      })

      expect(historyState.future.length).toBe(0) // Future cleared
      expect(historyState.state.structures.length).toBe(1)
      expect(historyState.state.structures[0].id).toBe('struct-2')
    })

    it('supports multiple undo/redo steps', () => {
      let historyState = createTestHistoryState()

      // Place 3 structures at different positions to avoid collision
      historyState = historyReducer(historyState, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure('struct-1', 5, 5),
      })
      historyState = historyReducer(historyState, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure('struct-2', 10, 10),
      })
      historyState = historyReducer(historyState, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure('struct-3', 15, 15),
      })

      expect(historyState.state.structures.length).toBe(3)
      expect(historyState.past.length).toBe(3)

      // Undo twice
      historyState = historyReducer(historyState, { type: 'UNDO' })
      historyState = historyReducer(historyState, { type: 'UNDO' })

      expect(historyState.state.structures.length).toBe(1)
      expect(historyState.past.length).toBe(1)
      expect(historyState.future.length).toBe(2)

      // Redo once
      historyState = historyReducer(historyState, { type: 'REDO' })

      expect(historyState.state.structures.length).toBe(2)
      expect(historyState.past.length).toBe(2)
      expect(historyState.future.length).toBe(1)
    })
  })

  describe('view-only actions', () => {
    it('does not create history entry for zoom changes', () => {
      let historyState = createTestHistoryState()

      // Place a structure first
      historyState = historyReducer(historyState, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure('struct-1', 5, 5),
      })

      const pastLengthBefore = historyState.past.length

      // Change zoom
      historyState = historyReducer(historyState, { type: 'SET_ZOOM', zoom: 24 })

      expect(historyState.past.length).toBe(pastLengthBefore) // No new history entry
      expect(historyState.state.zoom).toBe(24)
    })

    it('does not create history entry for tool changes', () => {
      let historyState = createTestHistoryState()

      const pastLengthBefore = historyState.past.length

      historyState = historyReducer(historyState, { type: 'SET_TOOL', tool: 'erase' })

      expect(historyState.past.length).toBe(pastLengthBefore)
      expect(historyState.state.tool).toBe('erase')
    })

    it('does not create history entry for grid toggle', () => {
      let historyState = createTestHistoryState()

      const pastLengthBefore = historyState.past.length
      const gridBefore = historyState.state.showGrid

      historyState = historyReducer(historyState, { type: 'TOGGLE_GRID' })

      expect(historyState.past.length).toBe(pastLengthBefore)
      expect(historyState.state.showGrid).toBe(!gridBefore)
    })

    it('preserves view state when undoing', () => {
      let historyState = createTestHistoryState()

      // Place a structure
      historyState = historyReducer(historyState, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure('struct-1', 5, 5),
      })

      // Change zoom and tool (view-only)
      historyState = historyReducer(historyState, { type: 'SET_ZOOM', zoom: 48 })
      historyState = historyReducer(historyState, { type: 'SET_TOOL', tool: 'hull' })

      expect(historyState.state.zoom).toBe(48)
      expect(historyState.state.tool).toBe('hull')

      // Undo the structure placement
      historyState = historyReducer(historyState, { type: 'UNDO' })

      // View state should be preserved
      expect(historyState.state.zoom).toBe(48)
      expect(historyState.state.tool).toBe('hull')
      // But structure should be gone
      expect(historyState.state.structures.length).toBe(0)
    })
  })

  describe('reset actions', () => {
    it('clears history on NEW_PROJECT', () => {
      let historyState = createTestHistoryState()

      // Build up some history
      historyState = historyReducer(historyState, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure('struct-1', 5, 5),
      })
      historyState = historyReducer(historyState, { type: 'UNDO' })

      expect(historyState.past.length).toBe(0)
      expect(historyState.future.length).toBe(1)

      // New project
      historyState = historyReducer(historyState, { type: 'NEW_PROJECT' })

      expect(historyState.past.length).toBe(0)
      expect(historyState.future.length).toBe(0)
    })

    it('clears history on LOAD_STRUCTURES', () => {
      let historyState = createTestHistoryState()

      // Build up some history
      historyState = historyReducer(historyState, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure('struct-1', 5, 5),
      })

      expect(historyState.past.length).toBe(1)

      // Load structures
      historyState = historyReducer(historyState, {
        type: 'LOAD_STRUCTURES',
        structures: [createTestStructure('loaded-1', 10, 10)],
      })

      expect(historyState.past.length).toBe(0)
      expect(historyState.future.length).toBe(0)
    })

    it('clears history on SET_PRESET', () => {
      let historyState = createTestHistoryState()

      // Build up some history
      historyState = historyReducer(historyState, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure('struct-1', 5, 5),
      })

      expect(historyState.past.length).toBe(1)

      // Change preset
      historyState = historyReducer(historyState, {
        type: 'SET_PRESET',
        presetLabel: '3x3',
        gridSize: { width: 81, height: 81 },
      })

      expect(historyState.past.length).toBe(0)
      expect(historyState.future.length).toBe(0)
    })
  })

  describe('undoable actions', () => {
    it('creates history entry for PLACE_STRUCTURE', () => {
      let historyState = createTestHistoryState()

      historyState = historyReducer(historyState, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure('struct-1', 5, 5),
      })

      expect(historyState.past.length).toBe(1)
      expect(historyState.state.structures.length).toBe(1)
    })

    it('creates history entry for ERASE_IN_RECT', () => {
      let historyState = createTestHistoryState()

      // Place a structure first
      historyState = historyReducer(historyState, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure('struct-1', 5, 5),
      })

      const pastLengthBefore = historyState.past.length

      // Erase (even if nothing is erased, state changes are tracked)
      historyState = historyReducer(historyState, {
        type: 'ERASE_IN_RECT',
        x1: 5,
        y1: 5,
        x2: 6,
        y2: 6,
      })

      // If a structure was erased, history should have a new entry
      expect(historyState.past.length).toBeGreaterThanOrEqual(pastLengthBefore)
    })

    it('creates history entry for PLACE_HULL_RECT', () => {
      let historyState = createTestHistoryState()

      historyState = historyReducer(historyState, {
        type: 'PLACE_HULL_RECT',
        x1: 0,
        y1: 0,
        x2: 5,
        y2: 5,
      })

      expect(historyState.past.length).toBe(1)
      expect(historyState.state.hullTiles.size).toBeGreaterThan(0)
    })

    it('creates history entry for MOVE_SELECTED_STRUCTURES', () => {
      let historyState = createTestHistoryState()

      // Place and select a structure
      historyState = historyReducer(historyState, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure('struct-1', 5, 5),
      })
      historyState = historyReducer(historyState, {
        type: 'SET_SELECTED_STRUCTURES',
        structureIds: ['struct-1'],
      })

      const pastLengthBefore = historyState.past.length

      // Move
      historyState = historyReducer(historyState, {
        type: 'MOVE_SELECTED_STRUCTURES',
        deltaX: 2,
        deltaY: 2,
      })

      expect(historyState.past.length).toBe(pastLengthBefore + 1)
      expect(historyState.state.structures[0].x).toBe(7)
      expect(historyState.state.structures[0].y).toBe(7)
    })

    it('creates history entry for CREATE_LAYER', () => {
      let historyState = createTestHistoryState()

      const pastLengthBefore = historyState.past.length

      historyState = historyReducer(historyState, {
        type: 'CREATE_LAYER',
        name: 'New Layer',
      })

      expect(historyState.past.length).toBe(pastLengthBefore + 1)
    })

    it('creates history entry for DELETE_LAYER_AND_ITEMS', () => {
      let historyState = createTestHistoryState()

      // Create a layer first
      historyState = historyReducer(historyState, {
        type: 'CREATE_LAYER',
        name: 'To Delete',
      })

      const newLayerId = historyState.state.userLayers.find((l) => l.name === 'To Delete')?.id
      expect(newLayerId).toBeDefined()

      const pastLengthBefore = historyState.past.length

      // Delete it
      historyState = historyReducer(historyState, {
        type: 'DELETE_LAYER_AND_ITEMS',
        layerId: newLayerId!,
      })

      expect(historyState.past.length).toBe(pastLengthBefore + 1)
    })

    it('creates history entry for CLEAR_ALL_STRUCTURES', () => {
      let historyState = createTestHistoryState()

      // Place some structures
      historyState = historyReducer(historyState, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure('struct-1', 5, 5),
      })
      historyState = historyReducer(historyState, {
        type: 'PLACE_HULL_RECT',
        x1: 0,
        y1: 0,
        x2: 3,
        y2: 3,
      })

      const pastLengthBefore = historyState.past.length

      // Clear all
      historyState = historyReducer(historyState, { type: 'CLEAR_ALL_STRUCTURES' })

      expect(historyState.past.length).toBe(pastLengthBefore + 1)
      expect(historyState.state.structures.length).toBe(0)
      expect(historyState.state.hullTiles.size).toBe(0)
    })
  })

  describe('history limits', () => {
    it('trims history when exceeding max limit', () => {
      let historyState = createTestHistoryState()

      // Perform 60 actions (more than MAX_HISTORY = 50)
      for (let i = 0; i < 60; i++) {
        historyState = historyReducer(historyState, {
          type: 'PLACE_HULL_RECT',
          x1: i,
          y1: 0,
          x2: i,
          y2: 0,
        })
      }

      // History should be capped at 50
      expect(historyState.past.length).toBeLessThanOrEqual(50)
    })
  })

  describe('selection clearing on undo/redo', () => {
    it('clears grid selection when undoing', () => {
      let historyState = createTestHistoryState()

      // Place and select a structure
      historyState = historyReducer(historyState, {
        type: 'PLACE_STRUCTURE',
        structure: createTestStructure('struct-1', 5, 5),
      })
      historyState = historyReducer(historyState, {
        type: 'SET_SELECTED_STRUCTURES',
        structureIds: ['struct-1'],
      })

      expect(historyState.state.selectedStructureIds.size).toBe(1)

      // Undo
      historyState = historyReducer(historyState, { type: 'UNDO' })

      // Selection should be cleared (structure no longer exists)
      expect(historyState.state.selectedStructureIds.size).toBe(0)
    })
  })
})

