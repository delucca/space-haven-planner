import { describe, it, expect } from 'vitest'
import { parseFootprintFromWikiText, generateStructureId } from './wiki'
import {
  BED_WIKITEXT,
  POD_HANGAR_WIKITEXT,
  WEAPONS_CONSOLE_WIKITEXT,
  BODY_STORAGE_WIKITEXT,
  ITEM_STORAGE_WIKITEXT,
  HULL_STABILIZER_WIKITEXT,
  NO_FOOTPRINT_WIKITEXT,
  INVALID_FOOTPRINT_WIKITEXT,
  UNICODE_MULTIPLY_WIKITEXT,
} from './__fixtures__/wikitext'

describe('parseFootprintFromWikiText', () => {
  it('parses infobox footprint format (1x2)', () => {
    const result = parseFootprintFromWikiText(BED_WIKITEXT)
    expect(result).toEqual({ width: 1, height: 2 })
  })

  it('parses "needs a NxM" format (4x3)', () => {
    const result = parseFootprintFromWikiText(POD_HANGAR_WIKITEXT)
    expect(result).toEqual({ width: 4, height: 3 })
  })

  it('parses "needs a NxM tile" format (3x3)', () => {
    const result = parseFootprintFromWikiText(WEAPONS_CONSOLE_WIKITEXT)
    expect(result).toEqual({ width: 3, height: 3 })
  })

  it('parses "NxM tiles" format (2x3)', () => {
    const result = parseFootprintFromWikiText(BODY_STORAGE_WIKITEXT)
    expect(result).toEqual({ width: 2, height: 3 })
  })

  it('parses "takes up NxM" format (2x2)', () => {
    const result = parseFootprintFromWikiText(ITEM_STORAGE_WIKITEXT)
    expect(result).toEqual({ width: 2, height: 2 })
  })

  it('parses infobox |size = NxM format (3x2)', () => {
    const result = parseFootprintFromWikiText(HULL_STABILIZER_WIKITEXT)
    expect(result).toEqual({ width: 3, height: 2 })
  })

  it('returns null when no footprint found', () => {
    const result = parseFootprintFromWikiText(NO_FOOTPRINT_WIKITEXT)
    expect(result).toBeNull()
  })

  it('returns null for unreasonably large footprints (sanity check)', () => {
    const result = parseFootprintFromWikiText(INVALID_FOOTPRINT_WIKITEXT)
    expect(result).toBeNull()
  })

  it('parses unicode multiplication sign (×)', () => {
    const result = parseFootprintFromWikiText(UNICODE_MULTIPLY_WIKITEXT)
    expect(result).toEqual({ width: 2, height: 3 })
  })

  it('returns null for empty string', () => {
    const result = parseFootprintFromWikiText('')
    expect(result).toBeNull()
  })

  it('handles text with no numbers', () => {
    const result = parseFootprintFromWikiText('This is just some text without any dimensions.')
    expect(result).toBeNull()
  })

  it('does not match random numbers without context', () => {
    // "5x5" alone without "tile", "footprint", etc. should not match
    const result = parseFootprintFromWikiText('The building produces 5x5 energy per second.')
    expect(result).toBeNull()
  })
})

describe('generateStructureId', () => {
  it('converts page title to lowercase snake_case', () => {
    expect(generateStructureId('Pod Hangar')).toBe('pod_hangar')
  })

  it('handles single word titles', () => {
    expect(generateStructureId('Bed')).toBe('bed')
  })

  it('handles titles with special characters', () => {
    expect(generateStructureId('X1 Power Generator')).toBe('x1_power_generator')
  })

  it('handles titles with multiple spaces', () => {
    expect(generateStructureId('Some   Building   Name')).toBe('some_building_name')
  })

  it('removes leading and trailing underscores', () => {
    expect(generateStructureId('  Test Building  ')).toBe('test_building')
  })

  it('handles hyphenated names', () => {
    expect(generateStructureId('Micro-Weaver')).toBe('micro_weaver')
  })

  it('handles numbers in names', () => {
    expect(generateStructureId('X2 Door')).toBe('x2_door')
  })
})
