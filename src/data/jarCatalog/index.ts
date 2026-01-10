/**
 * JAR Catalog module - parses Space Haven game data from spacehaven.jar
 */

// Types
export type {
  RawJarStructure,
  RawJarCategory,
  TextEntry,
  ParsedJarData,
  JarSourceInfo,
  JarCatalogData,
  JarCatalogSource,
} from './types'

// Parser
export { parseJarFile, parseJarBytes, extractTextEntries } from './parser'

// Converter
export {
  convertToStructureCatalog,
  mergeCatalogs,
  generateStructureId,
} from './converter'

// Manual hull structures
export { MANUAL_HULL_STRUCTURES, HULL_CATEGORY } from './hullStructures'

// Cache
export {
  loadCachedJarCatalog,
  saveJarCatalogCache,
  clearJarCatalogCache,
  hasJarCatalogCache,
  getCachedJarSourceInfo,
} from './cache'

// Built-in snapshot
export {
  BUILTIN_CATALOG,
  BUILTIN_SOURCE_INFO,
  BUILTIN_GAME_VERSION,
  BUILTIN_GENERATED_AT,
  getBuiltinCatalog,
  hasRealJarSnapshot,
} from './builtinSnapshot'

