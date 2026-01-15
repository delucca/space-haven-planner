/**
 * Tests for Space Haven save file converter
 */

import { describe, it, expect } from 'vitest'
import { parseSaveFile, parseShipById } from './parser'
import { convertShipToPlannerState } from './converter'
import type { StructureCatalog } from '@/data/types'
import sampleSaveXml from './__fixtures__/sample-save.xml?raw'

// Mock catalog with known structures
const mockCatalog: StructureCatalog = {
  categories: [
    {
      id: 'storage',
      name: 'Storage',
      color: '#8844cc',
      defaultLayer: 'Furniture',
      items: [
        {
          id: 'mid_632',
          name: 'Storage Container',
          size: [1, 1],
          color: '#8844cc',
          categoryId: 'storage',
        },
      ],
    },
    {
      id: 'power',
      name: 'Power',
      color: '#cc4444',
      defaultLayer: 'Systems',
      items: [
        {
          id: 'mid_2131',
          name: 'Power Generator',
          size: [2, 2],
          color: '#cc4444',
          categoryId: 'power',
        },
      ],
    },
  ],
}

describe('convertShipToPlannerState', () => {
  it('should convert a ship to planner state', () => {
    const { xmlDoc } = parseSaveFile(sampleSaveXml)
    const ship = parseShipById(xmlDoc, '1')

    expect(ship).not.toBeNull()

    const result = convertShipToPlannerState(ship!, mockCatalog)

    expect(result.preset).toBeDefined()
    expect(result.gridSize).toBeDefined()
    expect(result.hullTiles.length).toBeGreaterThan(0)
    expect(result.structures.length).toBeGreaterThan(0)
  })

  it('should choose the smallest fitting preset', () => {
    const { xmlDoc } = parseSaveFile(sampleSaveXml)
    const ship = parseShipById(xmlDoc, '1') // 27x27 ship

    expect(ship).not.toBeNull()

    const result = convertShipToPlannerState(ship!, mockCatalog)

    // Should fit in 1x1 preset (27x27)
    expect(result.preset.label).toBe('1x1')
    expect(result.gridSize.width).toBe(27)
    expect(result.gridSize.height).toBe(27)
  })

  it('should choose a larger preset for bigger ships', () => {
    const { xmlDoc } = parseSaveFile(sampleSaveXml)
    const ship = parseShipById(xmlDoc, '2') // 56x56 ship

    expect(ship).not.toBeNull()

    const result = convertShipToPlannerState(ship!, mockCatalog)

    // Should fit in 3x3 preset (81x81) since 2x2 (54x54) is too small
    expect(result.preset.width).toBeGreaterThanOrEqual(56)
    expect(result.preset.height).toBeGreaterThanOrEqual(56)
  })

  it('should extract hull tiles from known floor codes', () => {
    const { xmlDoc } = parseSaveFile(sampleSaveXml)
    const ship = parseShipById(xmlDoc, '1')

    expect(ship).not.toBeNull()

    const result = convertShipToPlannerState(ship!, mockCatalog)

    // Should have hull tiles from m=1148 entries
    expect(result.hullTiles.length).toBeGreaterThan(0)

    // Check that hull tiles have correct coordinates
    const hullCoords = result.hullTiles.map((t) => `${t.x},${t.y}`)
    expect(hullCoords).toContain('5,5')
    expect(hullCoords).toContain('6,5')
  })

  it('should convert known structures from catalog', () => {
    const { xmlDoc } = parseSaveFile(sampleSaveXml)
    const ship = parseShipById(xmlDoc, '1')

    expect(ship).not.toBeNull()

    const result = convertShipToPlannerState(ship!, mockCatalog)

    // Should have the storage container (mid_632)
    const storageContainer = result.structures.find((s) => s.structureId === 'mid_632')
    expect(storageContainer).toBeDefined()
    expect(storageContainer?.categoryId).toBe('storage')
    expect(storageContainer?.layer).toBe('Furniture')

    // Should have the power generator (mid_2131)
    const powerGen = result.structures.find((s) => s.structureId === 'mid_2131')
    expect(powerGen).toBeDefined()
    expect(powerGen?.categoryId).toBe('power')
    expect(powerGen?.layer).toBe('Systems')
    expect(powerGen?.rotation).toBe(90)
  })

  it('should generate warnings for unknown structures', () => {
    const { xmlDoc } = parseSaveFile(sampleSaveXml)
    const ship = parseShipById(xmlDoc, '1')

    expect(ship).not.toBeNull()

    const result = convertShipToPlannerState(ship!, mockCatalog)

    // Should have a warning about unknown structure (mid=99999)
    expect(result.warnings.length).toBeGreaterThan(0)
    const unknownWarning = result.warnings.find((w) => w.type === 'unknown_structure')
    expect(unknownWarning).toBeDefined()
  })

  it('should track conversion statistics', () => {
    const { xmlDoc } = parseSaveFile(sampleSaveXml)
    const ship = parseShipById(xmlDoc, '1')

    expect(ship).not.toBeNull()

    const result = convertShipToPlannerState(ship!, mockCatalog)

    expect(result.stats.totalElements).toBeGreaterThan(0)
    expect(result.stats.hullTilesCreated).toBeGreaterThan(0)
    expect(result.stats.structuresCreated).toBeGreaterThan(0)
    expect(result.stats.unknownMids).toBeGreaterThan(0)
  })

  it('should assign correct orgLayerId based on system layer', () => {
    const { xmlDoc } = parseSaveFile(sampleSaveXml)
    const ship = parseShipById(xmlDoc, '1')

    expect(ship).not.toBeNull()

    const result = convertShipToPlannerState(ship!, mockCatalog)

    const storageContainer = result.structures.find((s) => s.structureId === 'mid_632')
    expect(storageContainer?.orgLayerId).toBe('layer-furniture')

    const powerGen = result.structures.find((s) => s.structureId === 'mid_2131')
    expect(powerGen?.orgLayerId).toBe('layer-systems')
  })
})



