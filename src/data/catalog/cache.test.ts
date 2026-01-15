import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadCachedCatalog,
  saveCachedCatalog,
  clearCatalogCache,
  isStale,
  getCachedRevisionKey,
  CACHE_TTL_MS,
} from './cache'
import type { StructureCatalog } from '@/data/types'

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
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
})

// Sample catalog for testing
const sampleCatalog: StructureCatalog = {
  categories: [
    {
      id: 'test',
      name: 'Test Category',
      color: '#ffffff',
      defaultLayer: 'Hull',
      items: [
        {
          id: 'test_item',
          name: 'Test Item',
          size: [2, 2],
          color: '#000000',
          categoryId: 'test',
        },
      ],
    },
  ],
}

describe('isStale', () => {
  it('returns false for recent timestamps', () => {
    const recentTimestamp = Date.now() - 1000 // 1 second ago
    expect(isStale(recentTimestamp)).toBe(false)
  })

  it('returns true for timestamps older than TTL', () => {
    const oldTimestamp = Date.now() - CACHE_TTL_MS - 1000 // TTL + 1 second ago
    expect(isStale(oldTimestamp)).toBe(true)
  })

  it('returns false for timestamp exactly at TTL boundary', () => {
    const boundaryTimestamp = Date.now() - CACHE_TTL_MS + 1000 // Just under TTL
    expect(isStale(boundaryTimestamp)).toBe(false)
  })
})

describe('saveCachedCatalog', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('saves catalog to localStorage', () => {
    saveCachedCatalog(sampleCatalog, 'rev-123')

    expect(localStorageMock.setItem).toHaveBeenCalledTimes(1)
    const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1])

    expect(savedData.catalog).toEqual(sampleCatalog)
    expect(savedData.revisionKey).toBe('rev-123')
    expect(typeof savedData.fetchedAt).toBe('number')
  })

  it('handles localStorage errors gracefully', () => {
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceededError')
    })

    // Should not throw
    expect(() => saveCachedCatalog(sampleCatalog, 'rev-123')).not.toThrow()
  })
})

describe('loadCachedCatalog', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('returns null when no cache exists', () => {
    localStorageMock.getItem.mockReturnValueOnce(null)
    expect(loadCachedCatalog()).toBeNull()
  })

  it('returns cached data when valid', () => {
    const cachedData = {
      catalog: sampleCatalog,
      fetchedAt: Date.now(),
      revisionKey: 'rev-456',
    }
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(cachedData))

    const result = loadCachedCatalog()
    expect(result).not.toBeNull()
    expect(result?.catalog).toEqual(sampleCatalog)
    expect(result?.revisionKey).toBe('rev-456')
  })

  it('returns null for invalid JSON', () => {
    localStorageMock.getItem.mockReturnValueOnce('not valid json')
    expect(loadCachedCatalog()).toBeNull()
  })

  it('returns null for missing required fields', () => {
    const invalidData = {
      catalog: sampleCatalog,
      // missing fetchedAt and revisionKey
    }
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(invalidData))
    expect(loadCachedCatalog()).toBeNull()
  })

  it('returns null for invalid catalog structure', () => {
    const invalidData = {
      catalog: { notCategories: [] },
      fetchedAt: Date.now(),
      revisionKey: 'rev-789',
    }
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(invalidData))
    expect(loadCachedCatalog()).toBeNull()
  })

  it('returns null for catalog with invalid category', () => {
    const invalidData = {
      catalog: {
        categories: [{ invalid: 'category' }],
      },
      fetchedAt: Date.now(),
      revisionKey: 'rev-789',
    }
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(invalidData))
    expect(loadCachedCatalog()).toBeNull()
  })
})

describe('clearCatalogCache', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('removes cache from localStorage', () => {
    clearCatalogCache()
    expect(localStorageMock.removeItem).toHaveBeenCalledTimes(1)
  })

  it('handles localStorage errors gracefully', () => {
    localStorageMock.removeItem.mockImplementationOnce(() => {
      throw new Error('SecurityError')
    })

    // Should not throw
    expect(() => clearCatalogCache()).not.toThrow()
  })
})

describe('getCachedRevisionKey', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('returns null when no cache exists', () => {
    localStorageMock.getItem.mockReturnValueOnce(null)
    expect(getCachedRevisionKey()).toBeNull()
  })

  it('returns revision key when cache exists', () => {
    const cachedData = {
      catalog: sampleCatalog,
      fetchedAt: Date.now(),
      revisionKey: 'rev-abc',
    }
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(cachedData))

    expect(getCachedRevisionKey()).toBe('rev-abc')
  })

  it('returns null for invalid cache data', () => {
    localStorageMock.getItem.mockReturnValueOnce('invalid json')
    expect(getCachedRevisionKey()).toBeNull()
  })
})

describe('CACHE_TTL_MS', () => {
  it('is 7 days in milliseconds', () => {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    expect(CACHE_TTL_MS).toBe(sevenDaysMs)
  })
})


