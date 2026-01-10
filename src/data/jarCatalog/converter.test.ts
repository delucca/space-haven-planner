/**
 * Tests for JAR catalog converter
 */

import { describe, it, expect } from 'vitest'
import { convertToStructureCatalog, generateStructureId, mergeCatalogs } from './converter'
import type { ParsedJarData, RawJarStructure } from './types'
import type { StructureCatalog } from '@/data/types'

describe('generateStructureId', () => {
  it('should generate ID from mid', () => {
    const id = generateStructureId(1001)
    expect(id).toBe('mid_1001')
  })

  it('should handle different mids', () => {
    const id = generateStructureId(9999)
    expect(id).toBe('mid_9999')
  })
})

describe('convertToStructureCatalog', () => {
  // MainCat 1512 = OBJECTS (normal build menu)
  const OBJECTS_MAINCAT = 1512

  const createMockParsedData = (): ParsedJarData => {
    const texts = new Map<number, string>([
      [5001, 'Power Generator X1'],
      [5002, 'Oxygen Generator'],
      [5003, 'X1 Door'],
    ])

    const structures: RawJarStructure[] = [
      {
        mid: 1001,
        nameTid: 5001,
        subCatId: 1516, // Power category (JAR subCat 1516)
        size: { width: 2, height: 2 },
        debugName: 'PowerGenerator',
        tiles: [],
        linkedTiles: [],
        restrictions: [],
      },
      {
        mid: 1002,
        nameTid: 5002,
        subCatId: 1508, // Life Support category (JAR subCat 1508)
        size: { width: 3, height: 2 },
        debugName: 'OxygenGenerator',
        tiles: [],
        linkedTiles: [],
        restrictions: [],
      },
      {
        mid: 1003,
        nameTid: 5003,
        subCatId: 1522, // Wall category (JAR subCat 1522)
        size: { width: 1, height: 1 },
        debugName: 'X1Door',
        tiles: [],
        linkedTiles: [],
        restrictions: [],
      },
    ]

    // Categories must include parentId: 1512 (OBJECTS MainCat) for structures to be included
    const categories = [
      { id: 1516, nameTid: 878, parentId: OBJECTS_MAINCAT }, // Power
      { id: 1508, nameTid: 869, parentId: OBJECTS_MAINCAT }, // Life Support
      { id: 1522, nameTid: 885, parentId: OBJECTS_MAINCAT }, // Wall
    ]

    return {
      structures,
      texts,
      categories,
      gameVersion: '0.18.0',
    }
  }

  it('should convert parsed data to catalog format', () => {
    const parsed = createMockParsedData()
    const catalog = convertToStructureCatalog(parsed)

    expect(catalog.categories.length).toBeGreaterThan(0)

    // Find the power category
    const powerCat = catalog.categories.find((c) => c.id === 'power')
    expect(powerCat).toBeDefined()
    expect(powerCat?.items.length).toBe(1)
    expect(powerCat?.items[0].name).toBe('Power Generator X1')
    expect(powerCat?.items[0].size).toEqual([2, 2])
  })

  it('should assign structures to correct categories', () => {
    const parsed = createMockParsedData()
    const catalog = convertToStructureCatalog(parsed)

    // Check Wall category (JAR subCat 1522)
    const wallCat = catalog.categories.find((c) => c.id === 'wall')
    expect(wallCat?.items.some((s) => s.name === 'X1 Door')).toBe(true)

    // Check Life Support category (JAR subCat 1508)
    const lifeSupportCat = catalog.categories.find((c) => c.id === 'life_support')
    expect(lifeSupportCat?.items.some((s) => s.name === 'Oxygen Generator')).toBe(true)
  })

  it('should handle structures without known category', () => {
    const texts = new Map<number, string>([[5001, 'Unknown Thing']])
    const structures: RawJarStructure[] = [
      {
        mid: 1001,
        nameTid: 5001,
        subCatId: 9999, // Unknown category but in OBJECTS MainCat
        size: { width: 2, height: 2 },
        debugName: null,
        tiles: [],
        linkedTiles: [],
        restrictions: [],
      },
    ]

    // Must include the unknown category with parentId: 1512 for structure to be processed
    const categories = [{ id: 9999, nameTid: 0, parentId: OBJECTS_MAINCAT }]

    const catalog = convertToStructureCatalog({
      structures,
      texts,
      categories,
      gameVersion: null,
    })

    // Should be placed in "other" category (default for unknown)
    const otherCat = catalog.categories.find((c) => c.id === 'other')
    expect(otherCat?.items.some((s) => s.name === 'Unknown Thing')).toBe(true)
  })

  it('should default size to 2x2 when not specified', () => {
    const texts = new Map<number, string>([[5001, 'Small Item']])
    const structures: RawJarStructure[] = [
      {
        mid: 1001,
        nameTid: 5001,
        subCatId: 1516, // Power category (JAR subCat 1516)
        size: null, // No size - defaults to 2x2
        debugName: null,
        tiles: [],
        linkedTiles: [],
        restrictions: [],
      },
    ]

    // Must include the category with parentId: 1512 for structure to be processed
    const categories = [{ id: 1516, nameTid: 878, parentId: OBJECTS_MAINCAT }]

    const catalog = convertToStructureCatalog({
      structures,
      texts,
      categories,
      gameVersion: null,
    })

    const powerCat = catalog.categories.find((c) => c.id === 'power')
    expect(powerCat?.items[0].size).toEqual([2, 2])
  })

  it('should skip structures without names', () => {
    const texts = new Map<number, string>() // No text entries
    const structures: RawJarStructure[] = [
      {
        mid: 1001,
        nameTid: 5001, // No matching text
        subCatId: 1516, // Power category (JAR subCat 1516)
        size: { width: 2, height: 2 },
        debugName: null,
        tiles: [],
        linkedTiles: [],
        restrictions: [],
      },
    ]

    // Must include the category with parentId: 1512 for structure to be processed
    const categories = [{ id: 1516, nameTid: 878, parentId: OBJECTS_MAINCAT }]

    const catalog = convertToStructureCatalog({
      structures,
      texts,
      categories,
      gameVersion: null,
    })

    // Should have no structures since name couldn't be resolved
    // (Manual wall structures are now empty as they come from JAR)
    const totalStructures = catalog.categories.reduce((sum, cat) => sum + cat.items.length, 0)
    expect(totalStructures).toBe(0)
  })
})

describe('mergeCatalogs', () => {
  it('should merge two catalogs', () => {
    const catalog1: StructureCatalog = {
      categories: [
        {
          id: 'power',
          name: 'Power',
          color: '#cc8844',
          defaultLayer: 'Systems',
          items: [
            {
              id: 'gen1',
              name: 'Generator 1',
              size: [2, 2],
              color: '#aa0000',
              categoryId: 'power',
            },
          ],
        },
      ],
    }

    const catalog2: StructureCatalog = {
      categories: [
        {
          id: 'power',
          name: 'Power',
          color: '#cc8844',
          defaultLayer: 'Systems',
          items: [
            {
              id: 'gen2',
              name: 'Generator 2',
              size: [3, 3],
              color: '#bb0000',
              categoryId: 'power',
            },
          ],
        },
        {
          id: 'hull',
          name: 'Hull',
          color: '#3a4a5c',
          defaultLayer: 'Hull',
          items: [
            { id: 'wall1', name: 'Wall', size: [1, 1], color: '#555555', categoryId: 'hull' },
          ],
        },
      ],
    }

    const merged = mergeCatalogs(catalog1, catalog2)

    // Should have both categories
    expect(merged.categories.length).toBe(2)

    // Power category should have both structures
    const powerCat = merged.categories.find((c) => c.id === 'power')
    expect(powerCat?.items.length).toBe(2)

    // Hull category should have its structure
    const hullCat = merged.categories.find((c) => c.id === 'hull')
    expect(hullCat?.items.length).toBe(1)
  })

  it('should prefer primary catalog for duplicates', () => {
    const primary: StructureCatalog = {
      categories: [
        {
          id: 'power',
          name: 'Power',
          color: '#cc8844',
          defaultLayer: 'Systems',
          items: [
            {
              id: 'gen1',
              name: 'Generator (Updated)',
              size: [3, 3],
              color: '#aa0000',
              categoryId: 'power',
            },
          ],
        },
      ],
    }

    const secondary: StructureCatalog = {
      categories: [
        {
          id: 'power',
          name: 'Power',
          color: '#cc8844',
          defaultLayer: 'Systems',
          items: [
            {
              id: 'gen1',
              name: 'Generator (Old)',
              size: [2, 2],
              color: '#bb0000',
              categoryId: 'power',
            },
          ],
        },
      ],
    }

    const merged = mergeCatalogs(primary, secondary)

    const powerCat = merged.categories.find((c) => c.id === 'power')
    expect(powerCat?.items.length).toBe(1)
    expect(powerCat?.items[0].name).toBe('Generator (Updated)')
    expect(powerCat?.items[0].size).toEqual([3, 3])
  })
})
