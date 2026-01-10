/**
 * Tests for JAR file parser
 */

import { describe, it, expect } from 'vitest'
import { parseHavenXml, parseTextsXml, extractTextEntries } from './parser'
import sampleHavenXml from './__fixtures__/sample-haven.xml?raw'
import sampleTextsXml from './__fixtures__/sample-texts.xml?raw'

describe('parseTextsXml', () => {
  it('should parse text entries from XML', () => {
    const texts = parseTextsXml(sampleTextsXml)

    expect(texts.size).toBe(6)
    expect(texts.get(5001)).toBe('Power Generator X1')
    expect(texts.get(5002)).toBe('Oxygen Generator')
    expect(texts.get(5003)).toBe('Hull Block')
    expect(texts.get(5004)).toBe('Basic Bed')
    expect(texts.get(5005)).toBe('Floor Lamp')
    expect(texts.get(5006)).toBe('Unknown Structure')
  })

  it('should handle empty XML', () => {
    const texts = parseTextsXml('<data></data>')
    expect(texts.size).toBe(0)
  })

  it('should handle malformed XML gracefully', () => {
    // DOMParser doesn't throw on malformed XML, it returns empty results
    const texts = parseTextsXml('not xml')
    expect(texts.size).toBe(0)
  })
})

describe('parseHavenXml', () => {
  it('should parse structure definitions from XML', () => {
    const { structures } = parseHavenXml(sampleHavenXml)

    expect(structures.length).toBe(6)

    // Check Power Generator
    const powerGen = structures.find((s) => s.mid === 1001)
    expect(powerGen).toBeDefined()
    expect(powerGen?.nameTid).toBe(5001)
    expect(powerGen?.subCatId).toBe(1521)
    expect(powerGen?.size).toEqual({ width: 2, height: 2 })
    expect(powerGen?.debugName).toBe('PowerGenerator')
    expect(powerGen?.linkedTiles.length).toBe(4) // 2x2 grid

    // Check Oxygen Generator
    const oxyGen = structures.find((s) => s.mid === 1002)
    expect(oxyGen).toBeDefined()
    expect(oxyGen?.size).toEqual({ width: 3, height: 2 })
    expect(oxyGen?.linkedTiles.length).toBe(6) // 3x2 grid

    // Check Hull Block (1x1)
    const hull = structures.find((s) => s.mid === 1003)
    expect(hull).toBeDefined()
    expect(hull?.size).toEqual({ width: 1, height: 1 })
    expect(hull?.linkedTiles.length).toBe(1)

    // Check Bed
    const bed = structures.find((s) => s.mid === 1004)
    expect(bed).toBeDefined()
    expect(bed?.size).toEqual({ width: 2, height: 1 })
    expect(bed?.linkedTiles.length).toBe(2)
  })

  it('should handle structures without linked tiles', () => {
    const { structures } = parseHavenXml(sampleHavenXml)
    const decoration = structures.find((s) => s.mid === 1005)

    expect(decoration).toBeDefined()
    expect(decoration?.size).toBeNull()
    expect(decoration?.linkedTiles.length).toBe(0)
  })

  it('should handle structures without subCat', () => {
    const { structures } = parseHavenXml(sampleHavenXml)
    const unknown = structures.find((s) => s.mid === 1006)

    expect(unknown).toBeDefined()
    expect(unknown?.subCatId).toBeNull()
  })

  it('should handle empty XML', () => {
    const { structures } = parseHavenXml('<data><Element></Element></data>')
    expect(structures.length).toBe(0)
  })
})

describe('extractTextEntries', () => {
  it('should extract text entries from parsed texts', () => {
    const texts = parseTextsXml(sampleTextsXml)
    const entries = extractTextEntries(texts)

    expect(entries.length).toBe(6)
    expect(entries).toContainEqual({ id: 5001, en: 'Power Generator X1' })
    expect(entries).toContainEqual({ id: 5002, en: 'Oxygen Generator' })
  })
})
