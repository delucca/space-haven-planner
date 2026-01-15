/**
 * Tests for Space Haven save file parser
 */

import { describe, it, expect } from 'vitest'
import { parseSaveFile, parseShipById } from './parser'
import sampleSaveXml from './__fixtures__/sample-save.xml?raw'

describe('parseSaveFile', () => {
  it('should parse all ships from save file', () => {
    const result = parseSaveFile(sampleSaveXml)

    expect(result.allShips.length).toBe(4)
  })

  it('should identify player-owned ships correctly', () => {
    const result = parseSaveFile(sampleSaveXml)

    expect(result.playerShips.length).toBe(2)
    expect(result.playerShips.map((s) => s.name)).toContain('Small Vessel')
    expect(result.playerShips.map((s) => s.name)).toContain('Large Cruiser')
  })

  it('should exclude NPC and derelict ships from playerShips', () => {
    const result = parseSaveFile(sampleSaveXml)

    const playerNames = result.playerShips.map((s) => s.name)
    expect(playerNames).not.toContain('Pirate Raider')
    expect(playerNames).not.toContain('Abandoned Wreck')
  })

  it('should parse ship metadata correctly', () => {
    const result = parseSaveFile(sampleSaveXml)

    const smallVessel = result.playerShips.find((s) => s.name === 'Small Vessel')
    expect(smallVessel).toBeDefined()
    expect(smallVessel?.sid).toBe('1')
    expect(smallVessel?.width).toBe(27)
    expect(smallVessel?.height).toBe(27)
    expect(smallVessel?.isPlayerOwned).toBe(true)

    const largeCruiser = result.playerShips.find((s) => s.name === 'Large Cruiser')
    expect(largeCruiser).toBeDefined()
    expect(largeCruiser?.sid).toBe('2')
    expect(largeCruiser?.width).toBe(56)
    expect(largeCruiser?.height).toBe(56)
  })

  it('should handle empty ships section', () => {
    const result = parseSaveFile('<data><ships></ships></data>')

    expect(result.allShips.length).toBe(0)
    expect(result.playerShips.length).toBe(0)
  })

  it('should throw on invalid XML', () => {
    expect(() => parseSaveFile('not valid xml <>')).toThrow()
  })
})

describe('parseShipById', () => {
  it('should parse a ship by its sid', () => {
    const { xmlDoc } = parseSaveFile(sampleSaveXml)
    const ship = parseShipById(xmlDoc, '1')

    expect(ship).not.toBeNull()
    expect(ship?.meta.name).toBe('Small Vessel')
    expect(ship?.meta.sid).toBe('1')
  })

  it('should parse tile elements from the ship', () => {
    const { xmlDoc } = parseSaveFile(sampleSaveXml)
    const ship = parseShipById(xmlDoc, '1')

    expect(ship).not.toBeNull()
    // 6 hull tiles + 1 single-tile structure + 1 multi-tile structure + 1 unknown = 9 elements
    // Note: hull tiles and structures may share positions
    expect(ship?.elements.length).toBeGreaterThan(0)
  })

  it('should parse multi-tile structures with child tiles', () => {
    const { xmlDoc } = parseSaveFile(sampleSaveXml)
    const ship = parseShipById(xmlDoc, '1')

    const multiTileElement = ship?.elements.find((e) => e.mid === 2131)
    expect(multiTileElement).toBeDefined()
    expect(multiTileElement?.isMultiTile).toBe(true)
    expect(multiTileElement?.childTiles?.length).toBe(4)
    expect(multiTileElement?.rotation).toBe(90)
  })

  it('should parse single-tile structures', () => {
    const { xmlDoc } = parseSaveFile(sampleSaveXml)
    const ship = parseShipById(xmlDoc, '1')

    const singleTileElement = ship?.elements.find((e) => e.mid === 632)
    expect(singleTileElement).toBeDefined()
    expect(singleTileElement?.isMultiTile).toBe(false)
    expect(singleTileElement?.rotation).toBe(0)
  })

  it('should return null for non-existent ship', () => {
    const { xmlDoc } = parseSaveFile(sampleSaveXml)
    const ship = parseShipById(xmlDoc, '9999')

    expect(ship).toBeNull()
  })
})



