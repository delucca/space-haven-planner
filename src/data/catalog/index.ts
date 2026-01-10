export {
  STATIC_CATALOG,
  CATEGORY_LAYER_MAP,
  getCatalog,
  findStructureById,
  findCategoryById,
} from './structures'
export * from './cache'

// Legacy wiki catalog builder - deprecated, kept for backward compatibility
// New code should use JAR-based catalog from @/data/jarCatalog
export * from './wiki'

// Wiki metadata service - for supplemental data (images, descriptions)
export * from './wikiMetadata'
