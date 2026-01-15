import type { PlacedStructure, UserLayer, UserGroup } from '@/data/types'
import type { PlannerState, PlannerAction } from './types'
import { plannerReducer, createInitialState } from './reducer'

/**
 * Maximum number of undo steps to keep in history
 */
const MAX_HISTORY = 50

/**
 * Snapshot of the undoable portion of PlannerState.
 * Only model + organization fields are included (not view state like zoom/tool/grid).
 */
export interface UndoableSnapshot {
  readonly structures: readonly PlacedStructure[]
  readonly hullTiles: ReadonlySet<string>
  readonly userLayers: readonly UserLayer[]
  readonly userGroups: readonly UserGroup[]
  readonly activeLayerId: string | null
  readonly activeGroupId: string | null
}

/**
 * State shape for the history-aware reducer
 */
export interface HistoryState {
  readonly state: PlannerState
  readonly past: readonly UndoableSnapshot[]
  readonly future: readonly UndoableSnapshot[]
}

/**
 * Actions that reset history (loading external data or starting fresh).
 * After these actions, undo/redo stacks are cleared.
 */
const RESET_HISTORY_ACTIONS = new Set<PlannerAction['type']>([
  'NEW_PROJECT',
  'LOAD_STRUCTURES',
  'LOAD_HULL_TILES',
  'LOAD_USER_LAYERS',
  'LOAD_PROJECT',
  'SET_PRESET',
])

/**
 * Actions that don't affect the undoable model (view-only actions).
 * These should NOT create history entries.
 */
const VIEW_ONLY_ACTIONS = new Set<PlannerAction['type']>([
  'SET_ZOOM',
  'TOGGLE_GRID',
  'SET_TOOL',
  'SELECT_STRUCTURE',
  'CLEAR_SELECTION',
  'ROTATE_PREVIEW',
  'TOGGLE_LAYER_VISIBILITY',
  'TOGGLE_CATEGORY_EXPANDED',
  'TOGGLE_LAYER_EXPANDED',
  'TOGGLE_GROUP_EXPANDED',
  'SET_HOVERED_TILE',
  'SET_DRAGGING',
  'SET_SELECTED_STRUCTURES',
  'CLEAR_SELECTED_STRUCTURES',
  'SET_CATALOG',
  'SET_CATALOG_STATUS',
  'REQUEST_JAR_PARSE',
  'RESET_TO_BUILTIN_CATALOG',
])

/**
 * Create a snapshot of the undoable fields from state
 */
function createSnapshot(state: PlannerState): UndoableSnapshot {
  return {
    structures: state.structures,
    hullTiles: state.hullTiles,
    userLayers: state.userLayers,
    userGroups: state.userGroups,
    activeLayerId: state.activeLayerId,
    activeGroupId: state.activeGroupId,
  }
}

/**
 * Apply a snapshot to the current state, preserving view-only fields
 */
function applySnapshot(state: PlannerState, snapshot: UndoableSnapshot): PlannerState {
  return {
    ...state,
    structures: snapshot.structures,
    hullTiles: snapshot.hullTiles,
    userLayers: snapshot.userLayers,
    userGroups: snapshot.userGroups,
    activeLayerId: snapshot.activeLayerId,
    activeGroupId: snapshot.activeGroupId,
    // Clear grid selection when undoing/redoing since selected structures may no longer exist
    selectedStructureIds: new Set(),
  }
}

/**
 * Check if the undoable portion of state has changed
 */
function hasUndoableChange(prev: PlannerState, next: PlannerState): boolean {
  return (
    prev.structures !== next.structures ||
    prev.hullTiles !== next.hullTiles ||
    prev.userLayers !== next.userLayers ||
    prev.userGroups !== next.userGroups ||
    prev.activeLayerId !== next.activeLayerId ||
    prev.activeGroupId !== next.activeGroupId
  )
}

/**
 * Create initial history state
 */
export function createInitialHistoryState(): HistoryState {
  return {
    state: createInitialState(),
    past: [],
    future: [],
  }
}

/**
 * History-aware reducer that wraps plannerReducer.
 * Handles UNDO/REDO actions and maintains history stacks.
 */
export function historyReducer(historyState: HistoryState, action: PlannerAction): HistoryState {
  const { state, past, future } = historyState

  // Handle UNDO
  if (action.type === 'UNDO') {
    if (past.length === 0) {
      return historyState // Nothing to undo
    }

    const previousSnapshot = past[past.length - 1]
    const newPast = past.slice(0, -1)
    const currentSnapshot = createSnapshot(state)

    return {
      state: applySnapshot(state, previousSnapshot),
      past: newPast,
      future: [currentSnapshot, ...future],
    }
  }

  // Handle REDO
  if (action.type === 'REDO') {
    if (future.length === 0) {
      return historyState // Nothing to redo
    }

    const nextSnapshot = future[0]
    const newFuture = future.slice(1)
    const currentSnapshot = createSnapshot(state)

    return {
      state: applySnapshot(state, nextSnapshot),
      past: [...past, currentSnapshot],
      future: newFuture,
    }
  }

  // Run the inner reducer
  const nextState = plannerReducer(state, action)

  // If state didn't change, return as-is
  if (nextState === state) {
    return historyState
  }

  // Reset history actions: clear both stacks
  if (RESET_HISTORY_ACTIONS.has(action.type)) {
    return {
      state: nextState,
      past: [],
      future: [],
    }
  }

  // View-only actions: don't add to history
  if (VIEW_ONLY_ACTIONS.has(action.type)) {
    return {
      state: nextState,
      past,
      future,
    }
  }

  // Check if undoable fields changed
  if (!hasUndoableChange(state, nextState)) {
    return {
      state: nextState,
      past,
      future,
    }
  }

  // Push current state to past, clear future (new branch)
  const currentSnapshot = createSnapshot(state)
  const newPast = [...past, currentSnapshot]

  // Trim history if it exceeds max
  const trimmedPast = newPast.length > MAX_HISTORY ? newPast.slice(-MAX_HISTORY) : newPast

  return {
    state: nextState,
    past: trimmedPast,
    future: [], // Clear redo stack on new action
  }
}


