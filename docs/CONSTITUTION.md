# CONSTITUTION.md

**Project-specific facts and implementation details for Space Haven Planner**

> **Universal collaboration protocols**: see `../AGENTS.md`  
> **Canonical feature/spec doc**: `docs/USE_CASES.md` (must stay in sync with code)

---

## What this is

Space Haven Planner is an **unofficial**, **free**, **web-only** ship layout planner for the game *Space Haven*.

It’s meant to feel like Excalidraw: open → plan → export/share → close.  
**No accounts. No server-side state.**

### Target users

- **New players**: quick sketching + learning room/facility sizes
- **Min-maxers**: fast iteration, keyboard controls, shareable layouts

### Core principles

- **Offline-first**: the app should keep working without a network after the first load
- **Local-first**: designs live in the browser (localStorage / files)
- **Fast iteration**: low-latency interactions; keyboard-friendly
- **Minimal friction**: no login, no “projects” dashboard, no SaaS complexity

---

## Tech stack (rewrite target)

This repo currently contains a prototype reference (`reference/spacehaven-planner.jsx`). The production app will be a clean rewrite.

### Recommended stack

- **Frontend**: React 18 + TypeScript
- **Build**: Vite (SPA) + pnpm
- **Styling**: CSS (CSS Modules or vanilla) + CSS variables (dark theme first)
- **Tests**: Vitest + React Testing Library (unit/integration); Playwright (optional smoke E2E)
- **Hosting**: static hosting (Vercel / Netlify / GitHub Pages)

### Why Vite over Next.js

- This product is a **client-only SPA** (no accounts, no backend).
- Static hosting + offline caching is simpler than running server-rendered infra.

---

## Domain model

### Grid & coordinates

- The ship canvas is a 2D grid of tiles.
- Coordinates are integer tiles, origin at top-left **(0,0)**.
- **x** increases to the right, **y** increases downward.

### Presets

- Each “unit” is **27 tiles**.
- Presets are multiples (e.g., `2x2 = 54×54`, `3x2 = 81×54`).
- Presets are the only supported canvas sizes for MVP.

### Structure catalog

A **structure** is a placeable item with:

- `categoryKey` (e.g. `power`, `hull`)
- `itemKey` (e.g. `system_core_x1`)
- `name`
- `size` in tiles at rotation `0` → `[width, height]`
- `defaultLayer` (Hull, Rooms, Systems, Furniture)
- optional metadata (tags, wikiPage, etc.)

### Placement

A **placed structure** is an instance on the canvas:

- `id`: unique (UUID recommended)
- `categoryKey`, `itemKey`
- `x`, `y`: top-left anchor tile (at the current rotation)
- `rotation`: `0 | 90 | 180 | 270`
- `layer`: derived from the catalog’s `defaultLayer`
- future: `flipX/flipY`, `locked`, `notes`

### Layers

Layers exist to toggle visibility and reduce cognitive load:

- Hull
- Rooms
- Systems
- Furniture

Rule for MVP: **layer is derived from the structure category** (no “place on any layer”).

### Collisions

Collision detection is **global** (all layers): two placed items may not overlap in tile space.

---

## Persistence & portability

### Autosave (localStorage)

- Autosave the current project to localStorage on meaningful changes.
- Restore on load unless the user starts a new project.
- Never require login.

### File export/import

- **JSON**: canonical project format for editing and backup.
- **PNG**: quick sharing as an image.

### Shareable links (planned)

- Encode the project into the URL (prefer the fragment `#...`) and optionally compress.
- Opening the link loads the design without any server-side storage.
- Keep URL length constraints in mind.

---

## Structure data source (wiki + fallback)

We ship with a **built-in static catalog** (guaranteed to work offline), and optionally refresh it from the Space Haven community wiki.

- **Wiki reference**: [Space Haven Wiki](https://spacehaven.fandom.com/wiki/Space_Haven_Wiki)
- **API approach**: use the MediaWiki Action API (`api.php`) on Fandom.
- **CORS**: MediaWiki requires an `origin` query parameter for cross-site API calls; anonymous requests can use `origin=*`.
  - [MediaWiki Manual:CORS](https://www.mediawiki.org/wiki/Manual:CORS)
  - [MediaWiki API:Cross-site requests](https://www.mediawiki.org/wiki/API:Cross-site_requests)
  - [API:Get the contents of a page](https://www.mediawiki.org/wiki/API:Get_the_contents_of_a_page)

### Caching & etiquette

- Cache fetched catalog in localStorage with a timestamp and revision id.
- Refresh at most once per N days (e.g., 7) unless the user manually refreshes.
- If fetching/parsing fails: **fall back** to the built-in catalog, no breakage.

### Why we keep a fallback

Wiki markup and templates can change, pages can be incomplete, and APIs can be rate-limited.
The planner must remain usable even if the wiki is down or blocked.

---

## Monetization

The planner is free to use. Monetization is **donationware**:

- A small “Support this project” link/button (e.g., Buy Me a Coffee / Ko-fi)
- No paywalls for core features

---

## Legal / attribution

- This is a fan-made tool and is **not affiliated with Bugbyte Ltd.**
- “Space Haven” is a trademark of its respective owner(s).
- Data pulled from the community wiki should be attributed and cached responsibly.

---

## Prototype reference

The current prototype is stored in `reference/spacehaven-planner.jsx`.
It is a reference implementation only; the production app will be a clean rewrite.

---

## Updating this file

When product/architecture decisions change, update this constitution in the same PR as the code change.

