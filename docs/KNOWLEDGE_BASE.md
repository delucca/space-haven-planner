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

### “Source of truth” pointers
- **Product/behavior spec**: `docs/USE_CASES.md`
- **Project facts & decisions**: `docs/CONSTITUTION.md`
- **Configuration**: `package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `.prettierrc`
- **Entry point(s)**: `index.html`, `src/main.tsx`, `src/App.tsx`, `src/features/planner/PlannerPage.tsx`
- **Core domain logic**: `src/features/planner/state/reducer.ts`, `src/features/planner/canvas/renderer.ts`, `src/data/types.ts`
- **Data catalog**: `src/data/catalog/structures.ts`
- **External integrations**: none in code today (planned: Space Haven wiki via MediaWiki API; see `docs/CONSTITUTION.md`)

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
- **Error handling**:
  - User-triggered file errors show `alert(...)` (load/export).
  - Autosave failures warn and keep the app usable (`console.warn` + best-effort).
  - Context hooks fail fast if misused (throw outside provider).
- **Logging/observability**: `console.warn`/`console.error` only (no telemetry).
- **Testing strategy**:
  - Vitest + Testing Library are configured (see `vite.config.ts`, `src/test/setup.ts`).
  - Tests should be added as `src/**/*.{test,spec}.{ts,tsx}` (currently there are no test files).
  - Global test APIs (`describe`, `it`, `expect`) are available without imports (see `tsconfig.app.json` types).

---

## Invariants, constraints, and gotchas

- **Invariants**:
  - **Tile grid math**: coordinates are integer tile indices, origin at **(0,0)** top-left; x→right, y→down (see `docs/CONSTITUTION.md`).
  - **Canvas presets**: preset labels/dimensions come from `src/data/presets.ts` (`GRID_PRESETS`), where **1 unit = 27 tiles**.
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
  - **Project JSON versioning**: current format is **v2**; loader migrates v1 (`category`/`item` → `categoryId`/`structureId`) (see `src/lib/serialization/project.ts`).
  - **Unknown structure IDs in loaded projects**: they'll deserialize, but won't render (and won't collide / be erasable) because lookups fail; consider filtering or surfacing a warning if/when this becomes common.
  - **DPR scaling**: canvas uses `window.devicePixelRatio` for crisp rendering on HiDPI displays; coordinate math must account for this in `renderer.ts`.

---

## Glossary

- **Tile**: the atomic grid cell; all sizes/positions are expressed in tiles.
- **Unit**: Space Haven “grid unit” used by presets; **1 unit = 27×27 tiles**.
- **Preset**: labeled canvas size like `2x2` (see `GRID_PRESETS`).
- **Structure (catalog)**: a placeable type with `id`, `name`, `size`, `color`, `categoryId`.
- **Placed structure**: an instance on the grid with `x`, `y`, `rotation`, and derived `layer`.
- **Layer**: visibility grouping (`Hull | Rooms | Systems | Furniture`); rendering + PNG export only include visible layers.
- **Rotation**: `0/90/180/270` degrees; affects footprint via `getRotatedSize`.
- **Autosave**: debounced persistence of the current project JSON into `localStorage`.

---

## How to extend safely

- **Where to add new code**:
  - UI behavior/panels: `src/features/planner/components/`
  - Canvas interaction/rendering: `src/features/planner/canvas/`
  - State/actions/invariants: `src/features/planner/state/`
  - Domain types/presets/catalog: `src/data/`
  - Save/load/export formats: `src/lib/serialization/`
- **What to avoid**:
  - Mixing pixel units and tile units (always convert at boundaries like renderers).
  - Mutating state in-place (keep reducer/state immutable; clone `Set`s when updating).
  - Breaking offline/local-first constraints (avoid introducing required network calls).
  - Silent data loss in migrations/import (if dropping unknown structures, surface it to the user).
- **Verification checklist**:
  - [ ] Update `docs/USE_CASES.md` if user-visible behavior changes; update `docs/CONSTITUTION.md` if project facts/decisions change
  - [ ] `pnpm lint`
  - [ ] `pnpm format:check`
  - [ ] `pnpm test:run` (add/adjust tests as needed)
  - [ ] `pnpm build`
  - [ ] If changing the project file format: bump/migrate `PROJECT_VERSION` and keep load backward-compatible


