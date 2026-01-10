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

Space Haven Planner is an **unofficial**, **free**, **web-only** ship layout planner for the game _Space Haven_.
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

| Shortcut         | Action                   |
| ---------------- | ------------------------ |
| `+` / `=`        | Zoom in                  |
| `-` / `_`        | Zoom out                 |
| `Ctrl/Cmd + +/-` | Zoom in/out (also works) |
| `Q`              | Rotate counter-clockwise |
| `E`              | Rotate clockwise         |
| `1`              | Select Hull tool         |
| `2`              | Select Place tool        |
| `3`              | Select Erase tool        |
| `Escape`         | Clear selection          |

**Note**: Shortcuts are disabled when focus is in input/textarea/select elements.

### Zoom system

The zoom level is expressed internally as **pixels per tile** but displayed to users as a **percentage relative to fit-to-width**.

#### Initial zoom (fit-to-width)

On app load, the zoom level is dynamically calculated to fit the grid width within the viewport:

- Handled by `useInitialZoom` hook (`src/features/planner/hooks/useInitialZoom.ts`)
- Accounts for: left panel (280px), right panel (200px), canvas container padding (48px), canvas border (4px)
- Formula: `optimalZoom = floor((viewportWidth - sidePanels - padding - border) / gridWidth)`
- Result is clamped to `ZOOM_MIN`–`ZOOM_MAX` and snapped to `ZOOM_STEP`
- Only runs once on mount (uses a ref flag to prevent re-calculation)

#### Zoom control UI

The toolbar displays zoom as +/− buttons with an **editable percentage input** in between:

- **100%** = the zoom level at which the grid exactly fits the available canvas width
- Percentage is **dynamic**: recalculates on viewport resize and preset change
- **Editable input**: Click the percentage to type a custom value (Enter to apply, Escape to cancel)
- Input values are converted back to pixels-per-tile, clamped to `ZOOM_MIN`–`ZOOM_MAX`, and snapped to `ZOOM_STEP`
- Uses `useSyncExternalStore` to subscribe to window resize events
- Calculation logic in `Toolbar.tsx` mirrors `useInitialZoom.ts` (same layout constants)

### Tools

| Tool    | Purpose                                                                                    | Default                                 |
| ------- | ------------------------------------------------------------------------------------------ | --------------------------------------- |
| `hull`  | Drag-select to fill 1×1 hull tiles on mouseup (Shift = erase hull tiles)                   | ✓ (selected on load)                    |
| `place` | Click to place selected structure; drag-select highlights existing objects (no action yet) | Auto-selected when clicking a structure |
| `erase` | Drag-select highlights; on mouseup deletes selection (confirm unless hull-only)            |                                         |

### Hull system

Hull tiles are separate from structures:

- **Painted directly** on the grid (not from catalog)
- **Stored as** `Set<string>` of "x,y" keys in `PlannerState.hullTiles`
- **Auto-walls**: Walls automatically render on hull perimeter
- **Merged perimeters**: Adjacent hull tiles share walls (only outer edges get walls)
- **Erasable**: Erase tool removes hull tiles as well as structures (confirmation is required unless the selection contains only hull tiles)

### "Source of truth" pointers

- **Product/behavior spec**: `docs/USE_CASES.md`
- **Project facts & decisions**: `docs/CONSTITUTION.md`
- **Configuration**: `package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `.prettierrc`
- **Entry point(s)**: `index.html`, `src/main.tsx`, `src/App.tsx`, `src/features/planner/PlannerPage.tsx`
- **Core domain logic**: `src/features/planner/state/reducer.ts`, `src/features/planner/canvas/renderer.ts`, `src/data/types.ts`
- **Data catalog (JAR-based)**: `src/data/jarCatalog/` — primary catalog source from game JAR files
- **Data catalog (static fallback)**: `src/data/catalog/structures.ts` — offline-first fallback
- **Data catalog (wiki metadata)**: `src/data/catalog/wiki.ts` — supplemental metadata (images, descriptions)
- **Catalog caching**: `src/data/jarCatalog/cache.ts` and `src/data/catalog/cache.ts` — localStorage persistence
- **JAR catalog generation**: `scripts/generate-jar-catalog.ts` — generates built-in snapshot from reference JAR

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
  - **Custom checkboxes**: Native checkboxes are hidden (`opacity: 0; position: absolute`) and replaced with styled `<span>` indicators. Pattern:
    ```html
    <label className={styles.checkbox}>
      <input type="checkbox" ... />
      <span className={styles.checkboxIndicator} />
      Label text
    </label>
    ```
    CSS uses `input:checked + .checkboxIndicator` to style the checked state. See `Toolbar.module.css` and `LayerPanel.module.css` for examples.
- **State management**: reducer + Context (`PlannerProvider` / `usePlanner*` hooks); update state only via `PlannerAction`.
  - **Catalog state**: `PlannerState` includes `catalog` and `catalogStatus` (source, isParsing, lastUpdatedAt, lastError, jarFileName).
  - **Catalog load hook**: `useCatalogRefresh` loads cached user-uploaded JAR catalog on mount (if present) and otherwise ensures the built-in snapshot is active.
  - **Local UI state**: Purely presentational state (e.g., search queries, transient UI modes) should use local `useState` in components rather than polluting global `PlannerState`. Examples: `Palette.tsx` keeps search query local; `CanvasViewport.tsx` keeps drag-selection + pending erase confirmation local.
- **Form controls**:
  - Checkboxes: Use the custom checkbox pattern (hidden native + styled span indicator)
  - Selects/inputs: Use CSS variables from `global.css` for consistent styling
- **Dialogs**:
  - Use the native `<dialog>` element via `dialog.showModal()` + CSS Modules for a consistent look and better accessibility.
  - Reuse existing patterns: `JarImportDialog.tsx` and `ConfirmDialog.tsx` (avoid `window.confirm`).
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
    - `src/data/jarCatalog/parser.test.ts` — JAR XML parsing
    - `src/data/jarCatalog/converter.test.ts` — JAR to catalog conversion
    - `src/features/planner/hooks/useKeyboardShortcuts.test.ts` — keyboard shortcut handling
    - `src/features/planner/components/Palette.test.tsx` — palette UI (search, category expand/collapse)
    - `src/features/planner/state/reducer.test.ts` — state reducer and collision detection

---

## Invariants, constraints, and gotchas

- **Invariants**:
  - **Tile grid math**: coordinates are integer tile indices, origin at **(0,0)** top-left; x→right, y→down (see `docs/CONSTITUTION.md`).
  - **Canvas presets**: preset labels/dimensions come from `src/data/presets.ts` (`GRID_PRESETS`), where **1 unit = 27 tiles**.
  - **Zoom constants**: `ZOOM_MIN` (6), `ZOOM_MAX` (72), `ZOOM_STEP` (2), `DEFAULT_ZOOM` (12) are in `src/data/presets.ts`.
  - **Initial zoom**: Dynamically calculated on mount to fit grid width in viewport (see `useInitialZoom` hook).
  - **Rotation**: only `0 | 90 | 180 | 270`; footprint uses `getRotatedSize(...)` (`src/data/types.ts`).
  - **Tile rotation**: `rotateTilePosition()` in `renderer.ts` and `reducer.ts` handles rotating individual tiles within a structure's layout.
  - **Placement validity**: must be within bounds; collision rules depend on tile types (see below).
  - **Layer assignment**: placed structure `layer` is derived from the selected catalog category's `defaultLayer`.
  - **Tile-aware collision**:
    - New structure's **blocking tiles** (construction/blocked) cannot overlap **any** existing tile
    - New structure's **access tiles** can only overlap existing **access tiles**
- **Constraints**:
  - **No backend / no accounts**: persistence is local (`localStorage` + file exports).
  - **Offline-first**: must remain usable without network after first load.
  - **Node compatibility**: Vite 7 requires **Node.js ^20.19.0 || >=22.12.0**.
  - **Performance**: rendering is O(structure count) over a potentially large grid; avoid adding expensive work on every mouse move/state update.
  - **Tile coordinate normalization**: `TileLayout` coordinates must start at (0,0) for rotation to work correctly. The converter normalizes by subtracting minX/minY.
- **Gotchas**:
  - **Preset changes don't prune structures**: switching canvas size keeps existing placements; some may end up out of bounds (see UC-082).
  - **Autosave key**: `space-haven-planner-autosave` (see `src/features/planner/hooks/useAutosave.ts`).
  - **JAR catalog cache key**: `space-haven-planner-jar-catalog` (see `src/data/jarCatalog/cache.ts`).
  - **Project JSON versioning**: current format is **v2**; loader migrates v1 (`category`/`item` → `categoryId`/`structureId`) (see `src/lib/serialization/project.ts`).
  - **Unknown structure IDs in loaded projects**: they'll deserialize, but won't render (and won't collide / be erasable) because lookups fail.
  - **Interaction hit-testing**: for selection/erase, prefer tile-level footprints (includes `construction` + `blocked` + `access`) via `getStructureTiles(...).all` in `src/features/planner/state/reducer.ts`. Size-only bounding boxes can miss tiles when a `tileLayout` is present.
  - **DPR scaling**: canvas uses `window.devicePixelRatio` for crisp rendering on HiDPI displays; coordinate math must account for this in `renderer.ts`.
  - **JAR structure IDs**: Use `mid_XXX` format (e.g., `mid_120` for X1 Airlock). These differ from old wiki-derived IDs.
  - **Space restrictions for airlocks/cargo ports**: These structures have large "Space" restriction areas that define where space must be. All Space restriction tiles are included (not just adjacent ones) and rendered as red blocked areas.
  - **Gap filling in structures**: The converter fills gaps within the core bounding box to ensure solid rectangles. Without this, structures like airlocks would appear as scattered tiles.
  - **FloorDeco tiles**: Treated as `access` tiles (crew can walk on them), not `construction`. This affects collision and rendering.
  - **Layout constants duplication**: Both `useInitialZoom.ts` and `Toolbar.tsx` hardcode panel widths (280px left, 200px right) and padding (24px × 2). If `PlannerPage.module.css` changes, update **both** files' constants.
  - **JAR category IDs are not sequential**: The JAR uses non-sequential category IDs (e.g., 1506, 1507, 1508, 1516, 1519, 1522, 2880, 3359, 4243). Do NOT assume sequential IDs when mapping categories.
  - **Category display order is descending**: The game displays categories with higher `order` values first (leftmost). This is counterintuitive but matches the game UI.
  - **MainCat filtering is essential**: Only include structures from MainCat 1512 (OBJECTS). Structures from MainCat 1525 (SANDBOX) are debug/internal items that shouldn't appear in the planner. The parser extracts `parentId` from `<mainCat id="..."/>` child element.
  - **Duplicate structure names across MainCats**: The same structure name (e.g., "X1 Wall") can exist in multiple MainCats with different `mid` values. Always filter by MainCat to avoid duplicates.

---

## JAR-based catalog system

The structure catalog is now primarily derived from the game's `spacehaven.jar` file, which contains authoritative structure definitions.

### Catalog source priority

1. **User-uploaded JAR**: Users can upload their own `spacehaven.jar` via the "Import JAR" dialog
2. **Built-in JAR snapshot**: Pre-generated catalog in `src/data/jarCatalog/builtinSnapshot.ts`
3. **Static fallback**: Hardcoded structures for guaranteed offline functionality

### JAR file structure

The JAR is a ZIP archive containing XML files without extensions:

- `library/haven`: Structure definitions in `<me mid="...">` elements
- `library/texts`: Localization strings `<t id="..." EN="..."/>`

### Structure data extraction

Each structure (`<me>` element) contains:

| XML Element                                                                                            | Purpose                                                    |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `mid` attribute                                                                                        | Unique structure ID                                        |
| `<name tid="..."/>`                                                                                    | Reference to text entry for localized name                 |
| `<subCat id="..."/>`                                                                                   | Category ID reference                                      |
| `<data><l type="..." gridOffX="..." gridOffY="..." walkGridCost="..."/></data>`                        | Individual tile data (Door, Hull, FloorDeco, etc.)         |
| `<linked><l gridOffX="..." gridOffY="..."/></linked>`                                                  | Linked structural elements (define construction footprint) |
| `<restrictions><l type="Floor/Space" gridX="..." gridY="..." sizeX="..." sizeY="..."/></restrictions>` | Access/blocked areas                                       |

### Tile-level data model

Structures now have detailed tile layouts with three tile types:

| Tile Type      | Description                    | Rendering        | Collision                |
| -------------- | ------------------------------ | ---------------- | ------------------------ |
| `construction` | Actual structure tiles         | Solid color      | Blocks all               |
| `blocked`      | Impassable areas (hull, space) | Red overlay      | Blocks all               |
| `access`       | Walkable areas (crew access)   | Semi-transparent | Can overlap other access |

#### Tile type determination

- **Linked tiles** (`<linked>`) → `construction`
- **Data tiles with `walkGridCost >= 255`** → `blocked`
- **Data tiles with `elementType === 'FloorDeco' | 'Light'`** → `access`
- **Other data tiles** → `construction`
- **Floor restrictions** → `access`
- **Space/SpaceOneOnly restrictions** → `blocked`

#### Gap filling

The converter fills gaps within the core bounding box (data + linked tiles) to ensure solid rectangular structures. This is essential for structures like airlocks where the JAR defines scattered tiles but the game renders a solid floor area.

### Category system

#### JAR category structure

Categories in the JAR are organized hierarchically:

- **MainCat** (top-level): `<MainCat>` section contains main category tabs (OBJECTS, EDIT, SANDBOX, etc.)
- **SubCat** (sub-categories): `<SubCat>` section contains the actual build menu categories

Each SubCat entry has:

```xml
<cat id="1522" disabled="false" order="1">
  <mainCat id="1512"/>           <!-- Parent main category -->
  <button instance="..."/>
  <name tid="885"/>              <!-- Text ID for localized name -->
</cat>
```

Key attributes:

- `id`: Unique category ID (used in structure's `<subCat id="..."/>`)
- `order`: Display order within the main category
- `disabled`: Whether the category is hidden
- `mainCat id`: Parent category (1512 = OBJECTS for build menu)

#### MainCat filtering

**Critical**: Only structures from **MainCat 1512 (OBJECTS)** should appear in the planner. Other MainCats contain internal/debug items:

| MainCat ID | Name    | Purpose                                |
| ---------- | ------- | -------------------------------------- |
| 1512       | OBJECTS | Normal build menu (✅ include these)   |
| 1513       | EDIT    | Edit mode items (hull painting, etc.)  |
| 1525       | SANDBOX | Sandbox/debug items (❌ exclude these) |

The converter filters structures by checking if their `subCatId` belongs to a SubCat with `parentId === 1512`.

#### Category ID mapping

The converter maps JAR SubCat IDs (under MainCat 1512 = OBJECTS) to internal category IDs:

| JAR SubCat ID | Name TID | Game Name    | Internal ID    | JAR Order |
| ------------- | -------- | ------------ | -------------- | --------- |
| 4243          | 8018     | MISSION      | `mission`      | 20        |
| 1520          | 883      | WEAPON       | `weapon`       | 13        |
| 1519          | 882      | SYSTEM       | `system`       | 10        |
| 2880          | 4345     | ROBOTS       | `robots`       | 10        |
| 1521          | 884      | AIRLOCK      | `airlock`      | 9         |
| 1517          | 877      | STORAGE      | `storage`      | 8         |
| 1515          | 879      | FOOD         | `food`         | 7         |
| 1510          | 870      | RESOURCE     | `resource`     | 6         |
| 1516          | 878      | POWER        | `power`        | 5         |
| 1508          | 869      | LIFE SUPPORT | `life_support` | 4         |
| 1507          | 868      | FACILITY     | `facility`     | 3         |
| 3359          | 5127     | DECORATIONS  | `decorations`  | 2         |
| 1506          | 867      | FURNITURE    | `furniture`    | 2         |
| 1522          | 885      | WALL         | `wall`         | 1         |

The "Other" category exists as a fallback but should remain empty if all OBJECTS SubCats are mapped.

#### Display order

**Critical**: The game displays categories in **descending** order by JAR `order` attribute (highest order first, leftmost in UI). The table above reflects this display order.

To verify category order from JAR:

```bash
unzip -p reference/spacehaven.jar library/haven | grep -B 1 -A 6 'mainCat id="1512"'
```

#### Text localization

Category names are stored in `library/texts` with format:

```xml
<t id="885" pid="874">
  <EN>WALL</EN>
  <ES>PAREDES</ES>
  ...
</t>
```

The `tid` attribute in `<name tid="..."/>` references these text entries.

### Key files

| File                                     | Purpose                                               |
| ---------------------------------------- | ----------------------------------------------------- |
| `src/data/jarCatalog/types.ts`           | Type definitions for JAR parsing                      |
| `src/data/jarCatalog/parser.ts`          | JAR extraction and XML parsing                        |
| `src/data/jarCatalog/converter.ts`       | Convert parsed JAR data to `StructureCatalog`         |
| `src/data/jarCatalog/builtinSnapshot.ts` | Pre-generated catalog (auto-generated, do not edit)   |
| `src/data/jarCatalog/cache.ts`           | User-uploaded JAR caching                             |
| `src/data/jarCatalog/hullStructures.ts`  | Wall category metadata (structures now come from JAR) |
| `scripts/generate-jar-catalog.ts`        | Node script to regenerate built-in snapshot           |

### Generating the built-in snapshot

```bash
# Place spacehaven.jar in reference/ directory (gitignored)
npx tsx scripts/generate-jar-catalog.ts reference/spacehaven.jar
```

This regenerates `src/data/jarCatalog/builtinSnapshot.ts` with the latest structure data.

### Structure deduplication

Structures with the same name AND same size are merged (deduplicated) within each category. This handles color variants and duplicate entries in the JAR.

### Hull tool

Hull blocks are not in the JAR's build menu (they're in "Edit mode" in-game). The planner provides:

- **Hull Tool**: Drag-select a rectangle and fill hull tiles on mouseup (Shift = erase hull tiles)
- **Auto-wall generation**: Walls automatically appear on hull perimeter
- **Wall category**: Doors, windows, and walls come from JAR SubCat 1522 (WALL)

---

## Wiki integration (supplemental metadata)

The wiki is **no longer the primary catalog source**. It now provides supplemental metadata only.

### Current status

- Wiki fetch/parse code exists in `src/data/catalog/wiki.ts`
- Planned uses: structure images, extended descriptions, wiki page links
- **Not used for**: structure sizes, categories, or core catalog data

### Key files

- `src/data/catalog/wiki.ts` — wiki fetch, parse logic (for future metadata use)
- `src/data/catalog/wikiMetadata.ts` — metadata types and storage
- `src/data/catalog/cache.ts` — metadata caching

---

## Glossary

- **Tile**: the atomic grid cell; all sizes/positions are expressed in tiles.
- **Unit**: Space Haven "grid unit" used by presets; **1 unit = 27×27 tiles**.
- **Preset**: labeled canvas size like `2x2` (see `GRID_PRESETS`).
- **Structure (catalog)**: a placeable type with `id`, `name`, `size`, `color`, `categoryId`, and optional `tileLayout`.
- **TileLayout**: detailed tile-level data for a structure, including individual tile positions and types.
- **StructureTile**: a single tile within a structure's layout with `x`, `y`, `type` (construction/blocked/access), and `walkCost`.
- **Placed structure**: an instance on the grid with `x`, `y`, `rotation`, and derived `layer`.
- **Layer**: visibility grouping (`Hull | Rooms | Systems | Furniture`); rendering + PNG export only include visible layers.
- **Rotation**: `0/90/180/270` degrees; affects footprint via `getRotatedSize` and tile positions via `rotateTilePosition`.
- **Zoom**: pixels-per-tile scale factor; range `ZOOM_MIN` (6) to `ZOOM_MAX` (72), step `ZOOM_STEP` (2). Displayed as percentage where **100% = fit-to-width** (dynamically calculated based on viewport width, grid width, and panel sizes).
- **Autosave**: debounced persistence of the current project JSON into `localStorage`.
- **Hull tile**: a 1×1 painted hull cell (distinct from hull structures like walls/doors).
- **JAR**: the game's `spacehaven.jar` file, a ZIP archive containing game data in XML format.
- **mid**: structure ID in the JAR (`<me mid="...">`); used as `mid_XXX` in the catalog.
- **Space restriction**: JAR element defining areas that must be open to space (for airlocks, cargo ports).
- **SubCat**: Sub-category in the JAR's build menu hierarchy; contains the `order` attribute for display sorting.
- **MainCat**: Main category tab in the JAR (OBJECTS = 1512, EDIT = 1513, SANDBOX = 1525). Only structures from MainCat 1512 appear in the planner.
- **tid**: Text ID reference in the JAR; points to localized strings in `library/texts`.

---

## How to extend safely

- **Where to add new code**:
  - UI behavior/panels: `src/features/planner/components/`
  - Canvas interaction/rendering: `src/features/planner/canvas/`
  - State/actions/invariants: `src/features/planner/state/`
  - Domain types/presets/catalog: `src/data/`
  - JAR parsing/conversion: `src/data/jarCatalog/`
  - Wiki metadata: `src/data/catalog/wiki.ts`
  - Save/load/export formats: `src/lib/serialization/`
- **What to avoid**:
  - Mixing pixel units and tile units (always convert at boundaries like renderers).
  - Mutating state in-place (keep reducer/state immutable; clone `Set`s when updating).
  - Breaking offline/local-first constraints (avoid introducing required network calls).
  - Silent data loss in migrations/import (if dropping unknown structures, surface it to the user).
  - Editing `builtinSnapshot.ts` manually (it's auto-generated; run the script instead).
  - Forgetting to normalize tile coordinates in `TileLayout` (must start at 0,0).
- **JAR catalog changes**:
  - To update the built-in catalog: place new JAR in `reference/`, run `npx tsx scripts/generate-jar-catalog.ts reference/spacehaven.jar`
  - To change tile type logic: update `convertTileLayout()` in both `converter.ts` and `generate-jar-catalog.ts`
  - To add manual structures (like hull items): update `src/data/jarCatalog/hullStructures.ts`
  - To change category mapping: update `JAR_CATEGORY_MAP` in converter files
  - Always regenerate `builtinSnapshot.ts` after changing converter logic
- **Verification checklist**:
  - [ ] Update `docs/USE_CASES.md` if user-visible behavior changes; update `docs/CONSTITUTION.md` if project facts/decisions change
  - [ ] `pnpm lint`
  - [ ] `pnpm format:check`
  - [ ] `pnpm test:run` (add/adjust tests as needed)
  - [ ] `pnpm build`
  - [ ] If changing the project file format: bump/migrate `PROJECT_VERSION` and keep load backward-compatible
  - [ ] If changing JAR parsing: update tests in `parser.test.ts` and `converter.test.ts`
  - [ ] If changing tile layout logic: regenerate `builtinSnapshot.ts` and verify structures render correctly
