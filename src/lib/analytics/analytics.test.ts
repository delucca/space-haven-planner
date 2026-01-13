import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import posthog from 'posthog-js'

// Mock posthog-js
vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
  },
}))

// We need to re-import the module after mocking to get fresh state
// This is done via dynamic import in each test

describe('analytics wrapper', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    // Reset module state by clearing the module cache
    vi.resetModules()
  })

  afterEach(() => {
    // Clean up env vars
    delete (import.meta.env as Record<string, unknown>).VITE_POSTHOG_KEY
    delete (import.meta.env as Record<string, unknown>).VITE_POSTHOG_HOST
  })

  describe('initAnalytics', () => {
    it('does not initialize PostHog when VITE_POSTHOG_KEY is not set', async () => {
      // Ensure env var is not set
      delete (import.meta.env as Record<string, unknown>).VITE_POSTHOG_KEY

      const { initAnalytics, isAnalyticsEnabled } = await import('./index')

      initAnalytics()

      expect(posthog.init).not.toHaveBeenCalled()
      expect(isAnalyticsEnabled()).toBe(false)
    })

    it('initializes PostHog when VITE_POSTHOG_KEY is set', async () => {
      // Set env var
      ;(import.meta.env as Record<string, unknown>).VITE_POSTHOG_KEY = 'test-api-key'
      ;(import.meta.env as Record<string, unknown>).VITE_POSTHOG_HOST = 'https://test.posthog.com'

      const { initAnalytics, isAnalyticsEnabled } = await import('./index')

      initAnalytics()

      expect(posthog.init).toHaveBeenCalledWith('test-api-key', {
        api_host: 'https://test.posthog.com',
        autocapture: false,
        capture_pageview: true,
        capture_pageleave: true,
        disable_session_recording: true,
        persistence: 'localStorage',
        respect_dnt: true,
      })
      expect(isAnalyticsEnabled()).toBe(true)
    })

    it('uses default PostHog host when VITE_POSTHOG_HOST is not set', async () => {
      ;(import.meta.env as Record<string, unknown>).VITE_POSTHOG_KEY = 'test-api-key'
      delete (import.meta.env as Record<string, unknown>).VITE_POSTHOG_HOST

      const { initAnalytics } = await import('./index')

      initAnalytics()

      expect(posthog.init).toHaveBeenCalledWith(
        'test-api-key',
        expect.objectContaining({
          api_host: 'https://app.posthog.com',
        })
      )
    })
  })

  describe('capture', () => {
    it('does not capture events when analytics is disabled', async () => {
      delete (import.meta.env as Record<string, unknown>).VITE_POSTHOG_KEY

      const { initAnalytics, capture } = await import('./index')

      initAnalytics()
      capture('test_event', { prop: 'value' })

      expect(posthog.capture).not.toHaveBeenCalled()
    })

    it('captures events when analytics is enabled', async () => {
      ;(import.meta.env as Record<string, unknown>).VITE_POSTHOG_KEY = 'test-api-key'

      const { initAnalytics, capture } = await import('./index')

      initAnalytics()
      capture('test_event', { prop: 'value' })

      expect(posthog.capture).toHaveBeenCalledWith('test_event', { prop: 'value' })
    })

    it('captures events without properties', async () => {
      ;(import.meta.env as Record<string, unknown>).VITE_POSTHOG_KEY = 'test-api-key'

      const { initAnalytics, capture } = await import('./index')

      initAnalytics()
      capture('simple_event')

      expect(posthog.capture).toHaveBeenCalledWith('simple_event', undefined)
    })
  })

  describe('getMsSinceAppStart', () => {
    it('returns a positive number representing time since module load', async () => {
      const { getMsSinceAppStart } = await import('./index')

      // Wait a small amount of time
      await new Promise((resolve) => setTimeout(resolve, 10))

      const elapsed = getMsSinceAppStart()
      expect(elapsed).toBeGreaterThanOrEqual(10)
      expect(typeof elapsed).toBe('number')
    })
  })

  describe('resetAnalytics', () => {
    it('disables analytics after reset', async () => {
      ;(import.meta.env as Record<string, unknown>).VITE_POSTHOG_KEY = 'test-api-key'

      const { initAnalytics, resetAnalytics, isAnalyticsEnabled, capture } = await import('./index')

      initAnalytics()
      expect(isAnalyticsEnabled()).toBe(true)

      resetAnalytics()
      expect(isAnalyticsEnabled()).toBe(false)

      // Capture should no-op after reset
      vi.clearAllMocks()
      capture('test_event')
      expect(posthog.capture).not.toHaveBeenCalled()
    })
  })
})

