# KNOWLEDGE_BASE.md

**Durable, high-signal knowledge about this repository (for humans and AI agents).**

> **Universal collaboration protocols**: see `../AGENTS.md`  
> **Project-specific facts** (tech stack, setup, workflows): see `CONSTITUTION.md`

---

## How to use this doc

- This is a **living knowledge base**. Keep it **current** and **actionable**.
- Prefer **durable abstractions** over one-off incidents:
  - Architecture and boundaries
  - Invariants and constraints
  - Conventions and patterns
  - Workflows (dev/test/build/release)
  - Gotchas and sharp edges
- Avoid secrets and sensitive data.

---

## Repository overview

### Purpose
Space Haven Planner is an **unofficial**, **free**, **web-only** ship layout planner for the game *Space Haven*.
It’s a **client-only** React + TypeScript SPA that lets users choose a canvas preset, place/erase/rotate Space Haven structures on a tile grid (with bounds + collision validation), **autosaves locally**, and exports layouts as **JSON** and **PNG**.
There are **no accounts** and **no server-side state**; it should keep working offline after first load.

### Who uses it
Space Haven players:
- **New players**: learn structure sizes and rough in a first ship quickly.
- **Min-maxers**: iterate fast with keyboard shortcuts, export/share drafts, avoid rebuild churn in-game.

---

## Architecture (high-level)

### Key components
- **`src/features/planner/`**: main planner UI (page + panels + canvas viewport).
- **`src/features/planner/state/`**: reducer-driven app state, placement rules (bounds/collision), React context + hooks.
- **`src/features/planner/canvas/`**: `<canvas>` rendering + PNG export.
- **`src/data/`**: core domain types, grid presets, static structure catalog.
- **`src/lib/serialization/`**: project JSON format, save/load + v1→v2 migration helpers.
- **`docs/`**: product specs (`USE_CASES.md`), project facts/decisions (`CONSTITUTION.md`).

### Data / control flow
```
Mouse/keyboard input → dispatch(PlannerAction) → plannerReducer → PlannerState
  → CanvasViewport effect → renderer → <canvas> pixels
  → useAutosave effect → localStorage
  → ActionBar → download JSON / load JSON / export PNG
```

### Keyboard shortcuts

Handled by `useKeyboardShortcuts` hook (`src/features/planner/hooks/useKeyboardShortcuts.ts`):

| Shortcut | Action |
|----------|--------|
| `+` / `=` | Zoom in |
| `-` / `_` | Zoom out |
| `Ctrl/Cmd + +/-` | Zoom in/out (also works) |
| `Q` | Rotate counter-clockwise |
| `E` | Rotate clockwise |
| `1` | Select Place tool |
| `2` | Select Erase tool |
| `Escape` | Clear selection |

**Note**: Shortcuts are disabled when focus is in input/textarea/select elements.

### "Source of truth" pointers
- **Product/behavior spec**: `docs/USE_CASES.md`
- **Project facts & decisions**: `docs/CONSTITUTION.md`
- **Configuration**: `package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `.prettierrc`
- **Entry point(s)**: `index.html`, `src/main.tsx`, `src/App.tsx`, `src/features/planner/PlannerPage.tsx`
- **Core domain logic**: `src/features/planner/state/reducer.ts`, `src/features/planner/canvas/renderer.ts`, `src/data/types.ts`
- **Data catalog (static)**: `src/data/catalog/structures.ts` — offline-first fallback, always available
- **Data catalog (wiki)**: `src/data/catalog/wiki.ts` — dynamic fetch, parse, and merge logic
- **Catalog caching**: `src/data/catalog/cache.ts` — localStorage persistence with TTL
- **External integrations**: Optional wiki refresh from [Space Haven Wiki](https://spacehaven.fandom.com/) via MediaWiki API (see "Wiki integration" section below)

---

## Key workflows

### Setup
```bash
# Prereq: Node.js ^20.19.0 || >=22.12.0 (Vite 7 requirement)
pnpm install
```

### Run (dev)
```bash
pnpm dev         # default: http://localhost:5173
```

### Test
```bash
pnpm test           # watch mode
pnpm test:run       # CI-style run
pnpm test:coverage  # coverage report
```

### Lint & Format
```bash
pnpm lint           # ESLint check
pnpm lint:fix       # ESLint auto-fix
pnpm format         # Prettier write
pnpm format:check   # Prettier check (CI)
```

### Build / Release / Deploy
```bash
pnpm build       # outputs ./dist
pnpm preview     # serve the built app locally

# Deploy: planned Vercel (not deployed yet)
# - Build Command: pnpm build
# - Output Directory: dist
```

---

## Conventions & patterns

- **Project structure**:
  - Feature code lives under `src/features/` (planner is `src/features/planner/`).
  - Shared “domain” data/types live under `src/data/`.
  - Cross-cutting utilities live under `src/lib/`.
- **Imports**: use the `@/` alias for `src/` (configured in `vite.config.ts` + `tsconfig.app.json`).
- **Styling**: CSS Modules for components (`*.module.css`), plus `src/styles/global.css`.
- **State management**: reducer + Context (`PlannerProvider` / `usePlanner*` hooks); update state only via `PlannerAction`.
  - **Catalog state**: `PlannerState` includes `catalog`, `catalogStatus` (source, isRefreshing, lastUpdatedAt, lastError), and `catalogRefreshRequestId` for triggering refreshes.
  - **Catalog refresh hook**: `useCatalogRefresh` handles the async load/refresh lifecycle outside the reducer.
  - **Local UI state**: Purely presentational state (e.g., search queries, transient UI modes) should use local `useState` in components rather than polluting global `PlannerState`. Example: `Palette.tsx` keeps search query local.
- **Error handling**:
  - User-triggered file errors show `alert(...)` (load/export).
  - Autosave failures warn and keep the app usable (`console.warn` + best-effort).
  - Context hooks fail fast if misused (throw outside provider).
- **Logging/observability**: `console.warn`/`console.error` only (no telemetry).
- **Testing strategy**:
  - Vitest + Testing Library are configured (see `vite.config.ts`, `src/test/setup.ts`).
  - Tests should be added as `src/**/*.{test,spec}.{ts,tsx}`.
  - Global test APIs (`describe`, `it`, `expect`) are available without imports (see `tsconfig.app.json` types).
  - `@testing-library/user-event` is available for simulating user interactions in component tests.
  - **Testing components that use `usePlanner`**: Wrap with `<PlannerContext.Provider value={{ state, dispatch }}>` using a mock state object and `vi.fn()` dispatch. See `Palette.test.tsx` for the pattern.
  - Current tests:
    - `src/data/catalog/cache.test.ts` — catalog caching logic
    - `src/data/catalog/wiki.test.ts` — wiki parsing and merge logic
    - `src/features/planner/hooks/useKeyboardShortcuts.test.ts` — keyboard shortcut handling
    - `src/features/planner/components/Palette.test.tsx` — palette UI (search, category expand/collapse)

---

## Invariants, constraints, and gotchas

- **Invariants**:
  - **Tile grid math**: coordinates are integer tile indices, origin at **(0,0)** top-left; x→right, y→down (see `docs/CONSTITUTION.md`).
  - **Canvas presets**: preset labels/dimensions come from `src/data/presets.ts` (`GRID_PRESETS`), where **1 unit = 27 tiles**.
  - **Zoom constants**: `ZOOM_MIN`, `ZOOM_MAX`, `ZOOM_STEP`, `DEFAULT_ZOOM` are also in `src/data/presets.ts`.
  - **Rotation**: only `0 | 90 | 180 | 270`; footprint uses `getRotatedSize(...)` (`src/data/types.ts`).
  - **Placement validity**: must be within bounds and **must not overlap** any existing structure (collision is global across layers).
  - **Layer assignment**: placed structure `layer` is derived from the selected catalog category’s `defaultLayer`.
- **Constraints**:
  - **No backend / no accounts**: persistence is local (`localStorage` + file exports).
  - **Offline-first**: must remain usable without network after first load.
  - **Node compatibility**: Vite 7 requires **Node.js ^20.19.0 || >=22.12.0**.
  - **Performance**: rendering is O(structure count) over a potentially large grid; avoid adding expensive work on every mouse move/state update.
- **Gotchas**:
  - **Preset changes don't prune structures**: switching canvas size keeps existing placements; some may end up out of bounds (see UC-082).
  - **Autosave key**: `space-haven-planner-autosave` (see `src/features/planner/hooks/useAutosave.ts`).
  - **Catalog cache key**: `space-haven-planner-catalog-cache` (see `src/data/catalog/cache.ts`).
  - **Project JSON versioning**: current format is **v2**; loader migrates v1 (`category`/`item` → `categoryId`/`structureId`) (see `src/lib/serialization/project.ts`).
  - **Unknown structure IDs in loaded projects**: they'll deserialize, but won't render (and won't collide / be erasable) because lookups fail; consider filtering or surfacing a warning if/when this becomes common.
  - **DPR scaling**: canvas uses `window.devicePixelRatio` for crisp rendering on HiDPI displays; coordinate math must account for this in `renderer.ts`.
  - **Wiki structure IDs vs static IDs**: Wiki-derived structures use IDs generated from page titles (e.g., `pod_hangar`), which may differ from static catalog IDs. The merge logic handles this via name matching, but edge cases may exist.

---

## Wiki integration

### How it works

The planner can optionally refresh its structure catalog from the [Space Haven community wiki](https://spacehaven.fandom.com/) via the MediaWiki Action API. The wiki integration **supplements** the static catalog—it never replaces it entirely.

#### Discovery strategy (multi-source)

1. **Category fetching**: Queries multiple wiki categories:
   - `Category:Facilities`
   - `Category:Power`
   - `Category:System`
   - `Category:Production Facilities`
2. **AllPages fallback**: Also queries `Special:AllPages` API to catch structures not in any category
3. **Page filtering**: Uses `SKIP_PAGES` set (~80+ entries) to exclude meta pages, resources, data logs, game mechanics pages, etc.
4. **Deduplication**: Merges results from all sources into a unique set

#### Content fetching

- Fetches page content in batches (50 pages per request via MediaWiki API)
- Extracts revision IDs for cache validation

#### Parsing

- **Footprint extraction**: Multiple regex patterns for wiki text (e.g., "needs a 3x2 tile area", "footprint of 2x3", infobox `|size = NxM`)
- **Category inference**: From infobox `|category =` field, wiki `[[Category:...]]` links, or page name keywords
- **ID generation**: Page titles → snake_case IDs (e.g., "Pod Hangar" → `pod_hangar`)
- **Color generation**: Deterministic HSL color from structure name hash (for structures without static catalog match)

#### Merging with static catalog

The `buildCatalogFromWikiData()` function implements a **merge strategy**:

1. Wiki structures are parsed and matched against static catalog by name similarity
2. **Size priority**: Wiki footprint → static catalog size → default 2×2
3. **Color priority**: Static catalog color → generated color
4. **Category priority**: Parsed wiki category → static catalog category → "Other"
5. **Static-only structures preserved**: Structures in static catalog without wiki pages (hull, walls, doors, windows) are automatically included in the final catalog

This ensures:
- Wiki updates are reflected (new structures, updated sizes)
- Static structures without dedicated wiki pages remain available
- Existing saved projects with static structure IDs continue to work

### Caching

- Cached in `localStorage` with key `space-haven-planner-catalog-cache`
- TTL: 7 days (refreshes automatically if stale and online)
- Manual refresh via "Refresh Catalog" button in ActionBar
- Cache includes `fetchedAt` timestamp and `revisionKey` (hash of wiki revision IDs)

### Fallback behavior

- **Offline**: Uses built-in static catalog (`src/data/catalog/structures.ts`)
- **Fetch failure**: Keeps current catalog, shows non-intrusive error in StatusBar
- **Missing footprint**: Falls back to static catalog size or default 2×2
- **Unknown structures in saved projects**: Still renderable if they exist in static catalog

### Known limitations / gotchas

- **Cloudflare/CAPTCHA**: Fandom wikis may occasionally return challenge pages instead of JSON. The app detects this (checks `content-type` header) and falls back gracefully.
- **Wiki markup changes**: Footprint parsing relies on common patterns; unusual wiki formatting may not be recognized.
- **Category inference**: Not all structures map cleanly to our categories; some may end up in "Other".
- **No real-time sync**: Wiki changes are only picked up on refresh (manual or TTL expiry).
- **Skip list maintenance**: New meta/resource pages on the wiki may need to be added to `SKIP_PAGES` in `wiki.ts`.
- **Category coverage**: If the wiki reorganizes categories, `STRUCTURE_CATEGORIES` may need updating.

### Key files

- `src/data/catalog/wiki.ts` — wiki fetch, parse, merge logic, and skip list
- `src/data/catalog/cache.ts` — localStorage caching with TTL
- `src/data/catalog/structures.ts` — static fallback catalog (source of truth for offline)
- `src/features/planner/hooks/useCatalogRefresh.ts` — React hook for load/refresh lifecycle
- `src/data/catalog/__fixtures__/wikitext.ts` — test fixtures for wiki parsing

---

## Glossary

- **Tile**: the atomic grid cell; all sizes/positions are expressed in tiles.
- **Unit**: Space Haven “grid unit” used by presets; **1 unit = 27×27 tiles**.
- **Preset**: labeled canvas size like `2x2` (see `GRID_PRESETS`).
- **Structure (catalog)**: a placeable type with `id`, `name`, `size`, `color`, `categoryId`.
- **Placed structure**: an instance on the grid with `x`, `y`, `rotation`, and derived `layer`.
- **Layer**: visibility grouping (`Hull | Rooms | Systems | Furniture`); rendering + PNG export only include visible layers.
- **Rotation**: `0/90/180/270` degrees; affects footprint via `getRotatedSize`.
- **Zoom**: pixels-per-tile scale factor; range `ZOOM_MIN` (6) to `ZOOM_MAX` (24), step `ZOOM_STEP` (2).
- **Autosave**: debounced persistence of the current project JSON into `localStorage`.

---

## How to extend safely

- **Where to add new code**:
  - UI behavior/panels: `src/features/planner/components/`
  - Canvas interaction/rendering: `src/features/planner/canvas/`
  - State/actions/invariants: `src/features/planner/state/`
  - Domain types/presets/catalog: `src/data/`
  - Wiki integration/parsing: `src/data/catalog/wiki.ts`
  - Save/load/export formats: `src/lib/serialization/`
- **What to avoid**:
  - Mixing pixel units and tile units (always convert at boundaries like renderers).
  - Mutating state in-place (keep reducer/state immutable; clone `Set`s when updating).
  - Breaking offline/local-first constraints (avoid introducing required network calls).
  - Silent data loss in migrations/import (if dropping unknown structures, surface it to the user).
  - Removing structures from static catalog that may exist in saved projects.
- **Wiki integration changes**:
  - To add new wiki categories: update `STRUCTURE_CATEGORIES` array in `wiki.ts`
  - To skip new meta pages: add to `SKIP_PAGES` set in `wiki.ts`
  - To improve category mapping: update `WIKI_CATEGORY_MAP` in `wiki.ts`
  - To improve footprint parsing: add patterns to `parseFootprintFromWikiText()` in `wiki.ts`
  - Always ensure static catalog remains the offline fallback
- **Verification checklist**:
  - [ ] Update `docs/USE_CASES.md` if user-visible behavior changes; update `docs/CONSTITUTION.md` if project facts/decisions change
  - [ ] `pnpm lint`
  - [ ] `pnpm format:check`
  - [ ] `pnpm test:run` (add/adjust tests as needed)
  - [ ] `pnpm build`
  - [ ] If changing the project file format: bump/migrate `PROJECT_VERSION` and keep load backward-compatible
  - [ ] If changing wiki parsing: add test cases to `src/data/catalog/__fixtures__/wikitext.ts` and `wiki.test.ts`


