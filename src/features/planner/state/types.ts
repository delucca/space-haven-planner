import type {
  GridSize,
  LayerId,
  PlacedStructure,
  Rotation,
  StructureCatalog,
  ToolId,
} from '@/data/types'

/**
 * Selection state for the structure palette
 */
export interface StructureSelection {
  readonly categoryId: string
  readonly structureId: string
}

/**
 * Hover state for canvas interaction
 */
export interface HoverState {
  readonly x: number
  readonly y: number
}

/**
 * Complete planner application state
 */
export interface PlannerState {
  // Grid configuration
  readonly gridSize: GridSize
  readonly presetLabel: string
  readonly zoom: number
  readonly showGrid: boolean

  // Tool & selection
  readonly tool: ToolId
  readonly selection: StructureSelection | null
  readonly previewRotation: Rotation

  // Layers
  readonly visibleLayers: ReadonlySet<LayerId>
  readonly expandedCategories: ReadonlySet<string>

  // Placed structures
  readonly structures: readonly PlacedStructure[]

  // Interaction state
  readonly hoveredTile: HoverState | null
  readonly isDragging: boolean

  // Catalog (static for now, will support wiki refresh)
  readonly catalog: StructureCatalog
}

/**
 * Actions for the planner reducer
 */
export type PlannerAction =
  // Grid actions
  | { type: 'SET_PRESET'; presetLabel: string; gridSize: GridSize }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'TOGGLE_GRID' }

  // Tool actions
  | { type: 'SET_TOOL'; tool: ToolId }
  | { type: 'SELECT_STRUCTURE'; categoryId: string; structureId: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'ROTATE_PREVIEW'; direction: 'cw' | 'ccw' }

  // Layer actions
  | { type: 'TOGGLE_LAYER_VISIBILITY'; layer: LayerId }
  | { type: 'TOGGLE_CATEGORY_EXPANDED'; categoryId: string }

  // Structure placement actions
  | { type: 'PLACE_STRUCTURE'; structure: PlacedStructure }
  | { type: 'ERASE_AT'; x: number; y: number }
  | { type: 'CLEAR_ALL_STRUCTURES' }
  | { type: 'LOAD_STRUCTURES'; structures: PlacedStructure[] }

  // Interaction actions
  | { type: 'SET_HOVERED_TILE'; tile: HoverState | null }
  | { type: 'SET_DRAGGING'; isDragging: boolean }

  // Project actions
  | { type: 'LOAD_PROJECT'; state: Partial<PlannerState> }
  | { type: 'NEW_PROJECT' }

