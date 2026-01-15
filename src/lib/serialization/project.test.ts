import { describe, it, expect } from 'vitest'
import {
  PROJECT_VERSION,
  parseProjectFile,
  createProjectFile,
  serializeStructures,
  deserializeStructures,
  serializeUserLayers,
  deserializeUserLayers,
  serializeUserGroups,
  deserializeUserGroups,
} from './project'
import type { PlacedStructure, UserLayer, UserGroup, LayerId } from '@/data/types'

describe('Project Serialization', () => {
  describe('Version 4 Format', () => {
    it('should have PROJECT_VERSION = 4', () => {
      expect(PROJECT_VERSION).toBe(4)
    })

    it('should serialize and deserialize structures with org IDs', () => {
      const structures: PlacedStructure[] = [
        {
          id: 'struct-1',
          structureId: 'test-structure',
          categoryId: 'test-category',
          x: 5,
          y: 10,
          rotation: 90,
          layer: 'Systems' as LayerId,
          orgLayerId: 'layer-systems',
          orgGroupId: 'group-1',
        },
      ]

      const serialized = serializeStructures(structures)
      expect(serialized[0].orgLayerId).toBe('layer-systems')
      expect(serialized[0].orgGroupId).toBe('group-1')

      const deserialized = deserializeStructures(serialized)
      expect(deserialized[0].orgLayerId).toBe('layer-systems')
      expect(deserialized[0].orgGroupId).toBe('group-1')
    })

    it('should serialize and deserialize user layers', () => {
      const layers: UserLayer[] = [
        { id: 'layer-1', name: 'Custom Layer', isVisible: true, isLocked: false, order: 0 },
        { id: 'layer-2', name: 'Hidden Layer', isVisible: false, isLocked: true, order: 1 },
      ]

      const serialized = serializeUserLayers(layers)
      expect(serialized.length).toBe(2)
      expect(serialized[0].name).toBe('Custom Layer')
      expect(serialized[1].isVisible).toBe(false)
      expect(serialized[1].isLocked).toBe(true)

      const deserialized = deserializeUserLayers(serialized)
      expect(deserialized.length).toBe(2)
      expect(deserialized[0].name).toBe('Custom Layer')
      expect(deserialized[1].isVisible).toBe(false)
      expect(deserialized[1].isLocked).toBe(true)
    })

    it('should serialize and deserialize user groups', () => {
      const groups: UserGroup[] = [
        {
          id: 'group-1',
          layerId: 'layer-systems',
          name: 'Power Systems',
          isVisible: true,
          isLocked: false,
          order: 0,
          categoryId: 'power',
        },
      ]

      const serialized = serializeUserGroups(groups)
      expect(serialized[0].categoryId).toBe('power')

      const deserialized = deserializeUserGroups(serialized)
      expect(deserialized[0].categoryId).toBe('power')
    })

    it('should create complete project file with layers and groups', () => {
      const gridSize = { width: 50, height: 50 }
      const structures: PlacedStructure[] = [
        {
          id: 'struct-1',
          structureId: 'test-structure',
          categoryId: 'test-category',
          x: 5,
          y: 10,
          rotation: 0,
          layer: 'Systems' as LayerId,
          orgLayerId: 'layer-systems',
          orgGroupId: null,
        },
      ]
      const hullTiles = new Set(['5,5', '5,6'])
      const layers: UserLayer[] = [
        { id: 'layer-hull', name: 'Hull', isVisible: true, isLocked: false, order: 0 },
      ]
      const groups: UserGroup[] = []

      const project = createProjectFile(gridSize, 'Custom', structures, hullTiles, layers, groups)

      expect(project.version).toBe(4)
      expect(project.userLayers).toBeDefined()
      expect(project.userLayers?.length).toBe(1)
      expect(project.userGroups).toBeDefined()
      expect(project.structures[0].orgLayerId).toBe('layer-systems')
    })
  })

  describe('Migration from v3 and earlier', () => {
    it('should migrate v3 structures without org IDs', () => {
      const v3Data = {
        version: 3,
        gridSize: { width: 50, height: 50 },
        preset: 'Custom',
        structures: [
          {
            id: 'struct-1',
            structureId: 'test-structure',
            categoryId: 'test-category',
            x: 5,
            y: 10,
            rotation: 0,
            layer: 'Systems',
            // No orgLayerId or orgGroupId
          },
        ],
        hullTiles: [],
        // No userLayers or userGroups
      }

      const project = parseProjectFile(v3Data)

      // Should be upgraded to v4
      expect(project.version).toBe(4)

      // Structures should NOT have org IDs in the parsed file
      // (they will be migrated during deserialize)
      expect(project.structures[0].orgLayerId).toBeUndefined()

      // Deserialize should add default org IDs
      const structures = deserializeStructures(project.structures)
      expect(structures[0].orgLayerId).toBe('layer-systems')
      expect(structures[0].orgGroupId).toBeNull()

      // Should NOT have userLayers/userGroups (v3 didn't have them)
      expect(project.userLayers).toBeUndefined()
      expect(project.userGroups).toBeUndefined()

      // Deserialize should provide default layers
      const layers = deserializeUserLayers(project.userLayers)
      expect(layers.length).toBe(4)
      expect(layers.map((l) => l.id)).toEqual([
        'layer-hull',
        'layer-rooms',
        'layer-systems',
        'layer-furniture',
      ])
    })

    it('should migrate v1/v2 structures with old field names', () => {
      const v1Data = {
        version: 1,
        gridSize: { width: 50, height: 50 },
        preset: 'Custom',
        structures: [
          {
            id: 'struct-1',
            category: 'test-category', // Old field name
            item: 'test-structure', // Old field name
            x: 5,
            y: 10,
            rotation: 0,
            layer: 'Hull',
          },
        ],
      }

      const project = parseProjectFile(v1Data)

      // Should migrate field names
      expect(project.structures[0].categoryId).toBe('test-category')
      expect(project.structures[0].structureId).toBe('test-structure')

      // Deserialize should add default org IDs based on layer
      const structures = deserializeStructures(project.structures)
      expect(structures[0].orgLayerId).toBe('layer-hull')
    })

    it('should handle missing hullTiles in v2', () => {
      const v2Data = {
        version: 2,
        gridSize: { width: 50, height: 50 },
        preset: 'Custom',
        structures: [],
        // No hullTiles field
      }

      const project = parseProjectFile(v2Data)

      // Should have empty hullTiles array
      expect(project.hullTiles).toBeDefined()
      expect(project.hullTiles?.length).toBe(0)
    })
  })

  describe('parseProjectFile validation', () => {
    it('should throw on invalid input', () => {
      expect(() => parseProjectFile(null)).toThrow('Invalid project file: not an object')
      expect(() => parseProjectFile('string')).toThrow('Invalid project file: not an object')
    })

    it('should throw on missing gridSize', () => {
      expect(() =>
        parseProjectFile({
          preset: 'Custom',
          structures: [],
        })
      ).toThrow('Invalid project file: missing gridSize')
    })

    it('should throw on missing preset', () => {
      expect(() =>
        parseProjectFile({
          gridSize: { width: 50, height: 50 },
          structures: [],
        })
      ).toThrow('Invalid project file: missing preset')
    })

    it('should throw on invalid structures array', () => {
      expect(() =>
        parseProjectFile({
          gridSize: { width: 50, height: 50 },
          preset: 'Custom',
          structures: 'not an array',
        })
      ).toThrow('Invalid project file: structures is not an array')
    })
  })
})


