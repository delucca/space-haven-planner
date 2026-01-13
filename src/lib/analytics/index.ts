/**
 * Analytics wrapper for PostHog
 *
 * Provides a minimal, privacy-respecting analytics layer:
 * - No-ops when VITE_POSTHOG_KEY is not set
 * - Disables autocapture and session recording
 * - Tracks only curated product events
 *
 * @see docs/KNOWLEDGE_BASE.md for event taxonomy and configuration
 */

import posthog from 'posthog-js'

/** Track app start time for "time to first action" metrics */
const APP_START_TIME = Date.now()

/** Whether analytics is enabled (PostHog key is configured) */
let isEnabled = false

/**
 * Initialize PostHog analytics
 *
 * Must be called once at app startup (in main.tsx).
 * No-ops if VITE_POSTHOG_KEY env var is not set.
 */
export function initAnalytics(): void {
  const apiKey = import.meta.env.VITE_POSTHOG_KEY as string | undefined
  const apiHost = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://app.posthog.com'

  if (!apiKey) {
    // Analytics disabled - no API key configured
    return
  }

  try {
    posthog.init(apiKey, {
      api_host: apiHost,
      // Privacy-respecting defaults
      autocapture: false,
      capture_pageview: true,
      capture_pageleave: true,
      disable_session_recording: true,
      // Use localStorage for persistence (no cross-domain cookies)
      persistence: 'localStorage',
      // Respect Do Not Track browser setting
      respect_dnt: true,
    })
    isEnabled = true
  } catch (err) {
    console.warn('Failed to initialize PostHog analytics:', err)
  }
}

/**
 * Capture a custom analytics event
 *
 * No-ops if analytics is disabled or not initialized.
 *
 * @param eventName - Event name (e.g., 'structure_placed', 'export_png_success')
 * @param properties - Optional event properties (small scalars only)
 */
export function capture(
  eventName: string,
  properties?: Record<string, string | number | boolean | null>
): void {
  if (!isEnabled) return

  try {
    posthog.capture(eventName, properties)
  } catch {
    // Silently fail - analytics should never break the app
  }
}

/**
 * Get milliseconds since app started
 *
 * Useful for "time to first X" metrics.
 */
export function getMsSinceAppStart(): number {
  return Date.now() - APP_START_TIME
}

/**
 * Check if analytics is currently enabled
 */
export function isAnalyticsEnabled(): boolean {
  return isEnabled
}

/**
 * Reset analytics state (for testing)
 */
export function resetAnalytics(): void {
  isEnabled = false
}

