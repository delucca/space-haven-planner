import type {
  GridSize,
  HullTile,
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
 * Catalog data source
 *
 * - jar_builtin_snapshot: Built-in catalog shipped with the app (from reference JAR)
 * - jar_user: Freshly parsed from user-uploaded JAR
 * - jar_user_cache: Loaded from localStorage (user's previous JAR)
 */
export type CatalogSource = 'jar_builtin_snapshot' | 'jar_user' | 'jar_user_cache'

/**
 * Catalog refresh status
 */
export interface CatalogStatus {
  readonly source: CatalogSource
  readonly isParsing: boolean // True when parsing a user-uploaded JAR
  readonly lastUpdatedAt: number | null
  readonly lastError: string | null
  readonly jarFileName: string | null // Name of the user's JAR file (if applicable)
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

  // Hull tiles (painted with hull tool)
  readonly hullTiles: ReadonlySet<string> // Set of "x,y" keys for O(1) lookup

  // Interaction state
  readonly hoveredTile: HoverState | null
  readonly isDragging: boolean

  // Catalog (JAR-based)
  readonly catalog: StructureCatalog
  readonly catalogStatus: CatalogStatus
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
  | { type: 'ERASE_IN_RECT'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'CLEAR_ALL_STRUCTURES' }
  | { type: 'LOAD_STRUCTURES'; structures: PlacedStructure[] }

  // Hull tile actions
  | { type: 'PLACE_HULL_TILE'; x: number; y: number }
  | { type: 'PLACE_HULL_RECT'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'ERASE_HULL_TILE'; x: number; y: number }
  | { type: 'ERASE_HULL_RECT'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'LOAD_HULL_TILES'; tiles: HullTile[] }

  // Interaction actions
  | { type: 'SET_HOVERED_TILE'; tile: HoverState | null }
  | { type: 'SET_DRAGGING'; isDragging: boolean }

  // Project actions
  | { type: 'LOAD_PROJECT'; state: Partial<PlannerState> }
  | { type: 'NEW_PROJECT' }

  // Catalog actions
  | { type: 'SET_CATALOG'; catalog: StructureCatalog; source: CatalogSource }
  | { type: 'SET_CATALOG_STATUS'; status: Partial<CatalogStatus> }
  | { type: 'REQUEST_JAR_PARSE' } // Start parsing a user-uploaded JAR
  | { type: 'RESET_TO_BUILTIN_CATALOG' } // Clear user JAR and reset to built-in
