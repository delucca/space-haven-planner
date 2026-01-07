import type { GridSize, PlacedStructure, Rotation } from '@/data/types'

/** Current project file format version */
export const PROJECT_VERSION = 2

/**
 * Project file format for JSON save/load
 */
export interface ProjectFile {
  version: number
  gridSize: GridSize
  preset: string
  structures: SerializedStructure[]
}

/**
 * Serialized structure format (matches PlacedStructure but with explicit types for JSON)
 */
export interface SerializedStructure {
  id: string
  structureId: string
  categoryId: string
  x: number
  y: number
  rotation: Rotation
  layer: string
}

/**
 * Serialize placed structures for JSON export
 */
export function serializeStructures(structures: readonly PlacedStructure[]): SerializedStructure[] {
  return structures.map((s) => ({
    id: s.id,
    structureId: s.structureId,
    categoryId: s.categoryId,
    x: s.x,
    y: s.y,
    rotation: s.rotation,
    layer: s.layer,
  }))
}

/**
 * Deserialize structures from JSON import
 */
export function deserializeStructures(data: SerializedStructure[]): PlacedStructure[] {
  return data.map((s) => ({
    id: s.id,
    structureId: s.structureId,
    categoryId: s.categoryId,
    x: s.x,
    y: s.y,
    rotation: (s.rotation ?? 0) as Rotation,
    layer: s.layer as PlacedStructure['layer'],
  }))
}

/**
 * Create a project file object for saving
 */
export function createProjectFile(
  gridSize: GridSize,
  preset: string,
  structures: readonly PlacedStructure[]
): ProjectFile {
  return {
    version: PROJECT_VERSION,
    gridSize,
    preset,
    structures: serializeStructures(structures),
  }
}

/**
 * Validate and migrate a loaded project file
 */
export function parseProjectFile(data: unknown): ProjectFile {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid project file: not an object')
  }

  const obj = data as Record<string, unknown>

  // Check version (kept for future migrations)
  const _version = typeof obj.version === 'number' ? obj.version : 1
  void _version

  // Validate gridSize
  if (!obj.gridSize || typeof obj.gridSize !== 'object') {
    throw new Error('Invalid project file: missing gridSize')
  }

  const gridSize = obj.gridSize as Record<string, unknown>
  if (typeof gridSize.width !== 'number' || typeof gridSize.height !== 'number') {
    throw new Error('Invalid project file: invalid gridSize')
  }

  // Validate preset
  if (typeof obj.preset !== 'string') {
    throw new Error('Invalid project file: missing preset')
  }

  // Validate structures
  if (!Array.isArray(obj.structures)) {
    throw new Error('Invalid project file: structures is not an array')
  }

  // Migrate from v1 to v2 if needed
  const structures = obj.structures.map((s: unknown) => {
    if (!s || typeof s !== 'object') {
      throw new Error('Invalid project file: invalid structure entry')
    }

    const struct = s as Record<string, unknown>

    // v1 used 'category' and 'item', v2 uses 'categoryId' and 'structureId'
    const categoryId = (struct.categoryId ?? struct.category) as string
    const structureId = (struct.structureId ?? struct.item) as string

    if (!categoryId || !structureId) {
      throw new Error('Invalid project file: structure missing category/item identifiers')
    }

    return {
      id: String(struct.id ?? `migrated-${Math.random()}`),
      structureId,
      categoryId,
      x: Number(struct.x ?? 0),
      y: Number(struct.y ?? 0),
      rotation: (Number(struct.rotation) || 0) as Rotation,
      layer: String(struct.layer ?? 'Hull'),
    }
  })

  return {
    version: PROJECT_VERSION,
    gridSize: {
      width: gridSize.width as number,
      height: gridSize.height as number,
    },
    preset: obj.preset as string,
    structures,
  }
}

/**
 * Download a project as JSON file
 */
export function downloadProjectJSON(project: ProjectFile, filename = 'spacehaven-ship.json'): void {
  const json = JSON.stringify(project, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()

  URL.revokeObjectURL(url)
}

/**
 * Load a project from a JSON file
 */
export function loadProjectFromFile(file: File): Promise<ProjectFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const text = event.target?.result
        if (typeof text !== 'string') {
          throw new Error('Failed to read file')
        }

        const data = JSON.parse(text)
        const project = parseProjectFile(data)
        resolve(project)
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsText(file)
  })
}

/**
 * Download a data URL as a file
 */
export function downloadDataURL(dataURL: string, filename: string): void {
  const link = document.createElement('a')
  link.href = dataURL
  link.download = filename
  link.click()
}
