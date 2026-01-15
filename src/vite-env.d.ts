/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** PostHog project API key (public). Analytics disabled if not set. */
  readonly VITE_POSTHOG_KEY?: string
  /** PostHog API host. Defaults to https://app.posthog.com */
  readonly VITE_POSTHOG_HOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}



