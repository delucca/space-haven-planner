import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  loadCachedMetadata,
  saveCachedMetadata,
  isMetadataCacheStale,
  normalizeStructureName,
  findMetadataForStructure,
  getWikiMetadataForStructure,
  clearStructureCacheEntry,
  type WikiStructureMetadata,
} from './wikiMetadata'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    _getStore: () => store,
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
})

// Mock fetch
const mockFetch = vi.fn()
globalThis.fetch = mockFetch

// Sample metadata for testing
const sampleMetadata: WikiStructureMetadata = {
  pageTitle: 'Solar Panel',
  pageUrl: 'https://spacehaven.fandom.com/wiki/Solar_Panel',
  imageUrl: 'https://example.com/solar.png',
  description: 'A solar panel that generates power.',
  revisionId: 12345,
}

describe('normalizeStructureName', () => {
  it('converts to lowercase', () => {
    expect(normalizeStructureName('Solar Panel')).toBe('panel solar')
  })

  it('removes special characters', () => {
    expect(normalizeStructureName("System Core X1's")).toBe('core s system x1')
  })

  it('sorts words alphabetically', () => {
    expect(normalizeStructureName('Power Generator X1')).toBe('generator power x1')
    expect(normalizeStructureName('X1 Power Generator')).toBe('generator power x1')
  })

  it('handles multiple spaces', () => {
    expect(normalizeStructureName('Solar   Panel')).toBe('panel solar')
  })
})

describe('isMetadataCacheStale', () => {
  it('returns false for recent timestamps', () => {
    const recentTimestamp = Date.now() - 1000 // 1 second ago
    expect(isMetadataCacheStale(recentTimestamp)).toBe(false)
  })

  it('returns true for timestamps older than 24 hours', () => {
    const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000 // 25 hours ago
    expect(isMetadataCacheStale(oldTimestamp)).toBe(true)
  })

  it('returns false for timestamp just under 24 hours', () => {
    const boundaryTimestamp = Date.now() - 23 * 60 * 60 * 1000 // 23 hours ago
    expect(isMetadataCacheStale(boundaryTimestamp)).toBe(false)
  })
})

describe('saveCachedMetadata', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('saves metadata to localStorage', () => {
    const data = { 'solar panel': sampleMetadata }
    saveCachedMetadata(data)

    expect(localStorageMock.setItem).toHaveBeenCalledTimes(1)
    const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1])

    expect(savedData.data).toEqual(data)
    expect(typeof savedData.fetchedAt).toBe('number')
  })

  it('handles localStorage errors gracefully', () => {
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceededError')
    })

    // Should not throw
    expect(() => saveCachedMetadata({ 'solar panel': sampleMetadata })).not.toThrow()
  })
})

describe('loadCachedMetadata', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('returns null when no cache exists', () => {
    localStorageMock.getItem.mockReturnValueOnce(null)
    expect(loadCachedMetadata()).toBeNull()
  })

  it('returns cached data when valid', () => {
    const cachedData = {
      data: { 'solar panel': sampleMetadata },
      fetchedAt: Date.now(),
    }
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(cachedData))

    const result = loadCachedMetadata()
    expect(result).not.toBeNull()
    expect(result?.data).toEqual({ 'solar panel': sampleMetadata })
  })

  it('returns null for invalid JSON', () => {
    localStorageMock.getItem.mockReturnValueOnce('not valid json')
    expect(loadCachedMetadata()).toBeNull()
  })

  it('returns null for missing required fields', () => {
    const invalidData = {
      data: { 'solar panel': sampleMetadata },
      // missing fetchedAt
    }
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(invalidData))
    expect(loadCachedMetadata()).toBeNull()
  })
})

describe('findMetadataForStructure', () => {
  const metadata = {
    'solar panel': sampleMetadata,
    'power generator x1': {
      ...sampleMetadata,
      pageTitle: 'Power Generator X1',
    },
  }

  it('finds exact match (lowercase)', () => {
    const result = findMetadataForStructure('Solar Panel', metadata)
    expect(result).toEqual(sampleMetadata)
  })

  it('finds normalized match', () => {
    // "X1 Power Generator" normalizes to same as "Power Generator X1"
    const result = findMetadataForStructure('X1 Power Generator', metadata)
    expect(result?.pageTitle).toBe('Power Generator X1')
  })

  it('returns null when no match', () => {
    const result = findMetadataForStructure('Nonexistent Structure', metadata)
    expect(result).toBeNull()
  })
})

describe('getWikiMetadataForStructure', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns cached result when valid cache exists', async () => {
    // Set up per-structure cache
    const cacheKey = 'space-haven-planner-wiki-structure-solar_panel'
    const cachedEntry = {
      status: 'found',
      metadata: sampleMetadata,
      fetchedAt: Date.now(),
    }
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === cacheKey) return JSON.stringify(cachedEntry)
      return null
    })

    const result = await getWikiMetadataForStructure('Solar Panel')

    expect(result.status).toBe('found')
    expect(result.metadata).toEqual(sampleMetadata)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns cached missing result (negative cache)', async () => {
    const cacheKey = 'space-haven-planner-wiki-structure-nonexistent_item'
    const cachedEntry = {
      status: 'missing',
      metadata: null,
      fetchedAt: Date.now(),
    }
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === cacheKey) return JSON.stringify(cachedEntry)
      return null
    })

    const result = await getWikiMetadataForStructure('Nonexistent Item')

    expect(result.status).toBe('missing')
    expect(result.metadata).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches from API when no cache exists', async () => {
    localStorageMock.getItem.mockReturnValue(null)

    // First API call: page info with images list
    const pageInfoResponse = {
      query: {
        pages: [
          {
            pageid: 123,
            title: 'Solar Panel',
            revisions: [{ revid: 12345 }],
            images: [
              { ns: 6, title: 'File:SolarPanel.png' },
              { ns: 6, title: 'File:OtherImage.png' },
            ],
          },
        ],
      },
    }

    // Second API call: image info for the best matching image
    const imageInfoResponse = {
      query: {
        pages: [
          {
            pageid: 456,
            title: 'File:SolarPanel.png',
            imageinfo: [{ url: 'https://example.com/solar.png' }],
          },
        ],
      },
    }

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(pageInfoResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(imageInfoResponse),
      })

    const result = await getWikiMetadataForStructure('Solar Panel')

    expect(result.status).toBe('found')
    expect(result.metadata?.pageTitle).toBe('Solar Panel')
    expect(result.metadata?.imageUrl).toBe('https://example.com/solar.png')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('caches missing result when page not found', async () => {
    localStorageMock.getItem.mockReturnValue(null)

    const apiResponse = {
      query: {
        pages: [
          {
            title: 'Nonexistent Item',
            missing: true,
          },
        ],
      },
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: () => 'application/json',
      },
      json: () => Promise.resolve(apiResponse),
    })

    const result = await getWikiMetadataForStructure('Nonexistent Item')

    expect(result.status).toBe('missing')
    expect(result.metadata).toBeNull()

    // Verify negative cache was saved
    expect(localStorageMock.setItem).toHaveBeenCalled()
    const savedCall = localStorageMock.setItem.mock.calls.find((call) =>
      call[0].includes('nonexistent_item')
    )
    expect(savedCall).toBeDefined()
    const savedData = JSON.parse(savedCall![1])
    expect(savedData.status).toBe('missing')
  })

  it('refetches when cache is stale', async () => {
    const cacheKey = 'space-haven-planner-wiki-structure-solar_panel'
    const staleEntry = {
      status: 'found',
      metadata: sampleMetadata,
      fetchedAt: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
    }
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === cacheKey) return JSON.stringify(staleEntry)
      return null
    })

    // First API call: page info with images list
    const pageInfoResponse = {
      query: {
        pages: [
          {
            pageid: 123,
            title: 'Solar Panel',
            revisions: [{ revid: 99999 }], // New revision
            images: [{ ns: 6, title: 'File:SolarPanel.png' }],
          },
        ],
      },
    }

    // Second API call: image info
    const imageInfoResponse = {
      query: {
        pages: [
          {
            pageid: 456,
            title: 'File:SolarPanel.png',
            imageinfo: [{ url: 'https://example.com/solar_new.png' }],
          },
        ],
      },
    }

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(pageInfoResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(imageInfoResponse),
      })

    const result = await getWikiMetadataForStructure('Solar Panel')

    expect(result.status).toBe('found')
    expect(result.metadata?.revisionId).toBe(99999)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('handles fetch errors gracefully', async () => {
    localStorageMock.getItem.mockReturnValue(null)
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const result = await getWikiMetadataForStructure('Solar Panel')

    expect(result.status).toBe('missing')
    expect(result.metadata).toBeNull()
  })

  it('handles non-ok response', async () => {
    localStorageMock.getItem.mockReturnValue(null)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    const result = await getWikiMetadataForStructure('Solar Panel')

    expect(result.status).toBe('missing')
    expect(result.metadata).toBeNull()
  })
})

describe('clearStructureCacheEntry', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('removes cache entry from localStorage', () => {
    clearStructureCacheEntry('Solar Panel')

    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      'space-haven-planner-wiki-structure-solar_panel'
    )
  })

  it('handles localStorage errors gracefully', () => {
    localStorageMock.removeItem.mockImplementationOnce(() => {
      throw new Error('SecurityError')
    })

    // Should not throw
    expect(() => clearStructureCacheEntry('Solar Panel')).not.toThrow()
  })
})
