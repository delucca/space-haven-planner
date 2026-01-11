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

### Shared UI components

Reusable components live in `src/components/` and are exported via `@/components`.

#### Select component (`src/components/Select/`)

Custom dropdown replacement for native `<select>` with full styling and keyboard navigation:

| Keyboard       | Action                                      |
| -------------- | ------------------------------------------- |
| `Space/Enter`  | Open dropdown (when closed) / Select option |
| `Arrow Up/Down`| Navigate options                            |
| `Home/End`     | Jump to first/last option                   |
| `Escape`       | Close without selecting                     |
| `Tab`          | Close and move focus                        |
| Type character | Jump to option starting with that character |

Usage:
```tsx
import { Select, type SelectOption } from '@/components'

const options: SelectOption[] = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
]

<Select
  options={options}
  value={selectedValue}
  onChange={setValue}
  aria-label="My select"
/>
```

### Keyboard shortcuts

Handled by `useKeyboardShortcuts` hook (`src/features/planner/hooks/useKeyboardShortcuts.ts`):

| Shortcut              | Action                                       |
| --------------------- | -------------------------------------------- |
| `+` / `=`             | Zoom in                                      |
| `-` / `_`             | Zoom out                                     |
| `Ctrl/Cmd + +/-`      | Zoom in/out (also works)                     |
| `Q`                   | Rotate counter-clockwise                     |
| `E`                   | Rotate clockwise                             |
| `1`                   | Select tool (default)                        |
| `2`                   | Hull tool                                    |
| `3`                   | Place tool                                   |
| `4`                   | Erase tool                                   |
| `Space` + drag        | Pan canvas (works in all tools)              |
| `Shift` + click       | Add/remove structure from selection (Select) |
| `Delete` / `Backspace`| Delete selected structures (in Select mode)  |
| `Escape`              | Clear selection (palette + grid selection)   |

**Note**: Shortcuts are disabled when focus is in input/textarea/select elements.

### Zoom system

The zoom level is expressed internally as **pixels per tile** but displayed to users as a **percentage relative to fit-to-width**.

#### Initial zoom (fit-to-width)

On app load (and when the grid width changes, e.g. switching canvas preset), the zoom level is dynamically calculated to fit the grid width within the viewport:

- Handled by `useInitialZoom` hook (`src/features/planner/hooks/useInitialZoom.ts`)
- Uses shared helper `calculateFitZoomForViewport(...)` (`src/features/planner/zoom.ts`)
- **Measured dynamically**: Uses `ResizeObserver` to measure the actual canvas container content width
- Formula: `optimalZoom = floor((canvasContentWidth - canvasBorder) / gridWidth)`
- Result is clamped by the reducer to `ZOOM_MIN`–`ZOOM_MAX` (not snapped to `ZOOM_STEP`)
- Recalculates when `gridWidth` changes (not on sidebar resize/collapse)
- **NEW_PROJECT preserves** the current `zoom` (and canvas preset) to avoid jarring zoom jumps

#### Zoom control UI

The toolbar displays zoom as +/− buttons with an **editable percentage input** in between:

- **100%** = the zoom level at which the grid exactly fits the available canvas width
- Percentage is **dynamic**: recalculates when canvas container width changes (sidebar resize/collapse, window resize, preset change)
- **Important**: Sidebar resize/collapse changes only the displayed %, NOT the actual zoom value (pixels per tile)
- **Editable input**: Click the percentage to type a custom value (Enter to apply, Escape to cancel)
- Input values are converted back to pixels-per-tile and clamped to `ZOOM_MIN`–`ZOOM_MAX` (not snapped to `ZOOM_STEP`)
- Uses `useElementContentWidth` hook with `ResizeObserver` to measure canvas container width
- Calculation uses `calculateFitZoomForViewport(...)` (`src/features/planner/zoom.ts`) so the 100% baseline matches `useInitialZoom`

### Layout system

The planner has a flexible layout with resizable and collapsible sidebars.

#### Sidebar panels

| Panel | Default Width | Min Width | Max Width | Content |
| ----- | ------------- | --------- | --------- | ------- |
| Left  | 280px         | 220px     | 520px     | Palette (structure catalog) |
| Right | 320px         | 240px     | 640px     | Layer panel |

#### Layout controls

Icon buttons in the toolbar header allow toggling sidebar visibility:

- **Left sidebar toggle**: Show/hide the left (Palette) panel
- **Both sidebars toggle**: Show/hide both panels at once
- **Right sidebar toggle**: Show/hide the right (Layer) panel

#### Resize handles

Thin drag handles between panels allow resizing:

- Drag left handle to resize the left panel
- Drag right handle to resize the right panel
- Visual feedback: handle highlights blue on hover and during drag
- Text selection is disabled during resize

#### Peek overlays (collapsed sidebars)

When a sidebar is collapsed:

- An invisible 8px hotspot at the screen edge triggers peek
- Hovering the hotspot shows the sidebar as a **fixed overlay** (does not affect layout)
- The overlay has a shadow and appears above the canvas
- Moving the mouse away from the overlay hides it
- **Important**: Peek overlays do NOT affect the zoom baseline (canvas width unchanged)

#### Persistence

Layout state is persisted in `localStorage` under key `space-haven-planner-layout`:

```typescript
{
  leftWidth: number,
  rightWidth: number,
  isLeftCollapsed: boolean,
  isRightCollapsed: boolean
}
```

#### Key files

| File | Purpose |
| ---- | ------- |
| `src/features/planner/PlannerPage.tsx` | Layout state, resize/collapse logic |
| `src/features/planner/PlannerPage.module.css` | Panel, resize handle, peek overlay styles |
| `src/features/planner/components/LayoutControls.tsx` | Sidebar toggle icon buttons |
| `src/features/planner/hooks/useElementContentWidth.ts` | ResizeObserver-based width measurement |

### Tools

| Tool     | Purpose                                                                                    | Default                                 |
| -------- | ------------------------------------------------------------------------------------------ | --------------------------------------- |
| `select` | Click to move structures; box-select; Shift+click to multi-select; Delete/Backspace removes | ✓ (selected on load)                    |
| `hull`   | Drag-select to fill 1×1 hull tiles on mouseup (Shift = erase hull tiles)                   |                                         |
| `place`  | Click to place selected structure; drag-select highlights existing objects (no action yet) | Auto-selected when clicking a structure |
| `erase`  | Drag-select highlights; on mouseup deletes selection (confirm unless hull-only)            |                                         |
| `grid`   | Toggle button to show/hide grid lines on the canvas                                        | ✓ (grid visible on load)                |

**Note**: `Space` + drag pans the canvas in **all tools**.

#### Select tool behavior

The Select tool (`1`) is the default tool on app load. It provides:

- **Box selection**: Drag on empty canvas to select structures within the rectangle
- **Shift+click**: Add/remove structures from selection (toggle)
- **Move any structure**: Click and drag on any structure to move it (auto-selects if not selected)
- **Move multiple**: If clicking on an already-selected structure, moves all selected structures together
- **Move validation**: Moves are validated against bounds and collisions; invalid moves show red preview and snap back
- **Pan mode**: Hold `Space` and drag to pan/scroll the canvas (works in all tools)
- **Delete selected**: Press `Delete` or `Backspace` to delete selected structures (with confirmation)
- **Selection display**: Selected structures appear in the right sidebar "Selected" section
- **Clear selection**: Press `Escape` or click "Clear Selection" button
- **Cursor feedback**: Shows `move` cursor when hovering over any structure

Selected structures are stored in `PlannerState.selectedStructureIds` (a `ReadonlySet<string>`).

### Grid rendering

The canvas grid is rendered in layers (back to front):

1. **Background**: Solid dark color (`#1a1e24`)
2. **Grid lines**: Thin lines (`#2a3040`) every tile
3. **Center crosshair**: Thick teal lines (`#1a5a5a`, 3px) marking grid center — matches the game's visual style
4. **Hull tiles**: Painted hull cells with auto-walls
5. **Structures**: Placed catalog items
6. **Previews/overlays**: Placement preview, selection rectangles

The center crosshair is dynamically positioned at `floor(gridSize.width / 2)` and `floor(gridSize.height / 2)`, so it adjusts automatically when the canvas preset changes.

### Hull system

Hull tiles are separate from structures:

- **Painted directly** on the grid (not from catalog)
- **Stored as** `Set<string>` of "x,y" keys in `PlannerState.hullTiles`
- **Auto-walls**: Walls automatically render on hull perimeter
- **Merged perimeters**: Adjacent hull tiles share walls (only outer edges get walls)
- **Erasable**: Erase tool removes hull tiles as well as structures (confirmation is required unless the selection contains only hull tiles)

### CAD-style layer system

The planner uses a CAD-style hierarchy for organizing structures: **UserLayers → UserGroups → Structures**.

#### Data model

| Entity        | Fields                                                        | Purpose                          |
| ------------- | ------------------------------------------------------------- | -------------------------------- |
| `UserLayer`   | `id`, `name`, `isVisible`, `isLocked`, `order`                | Top-level organization           |
| `UserGroup`   | `id`, `layerId`, `name`, `isVisible`, `isLocked`, `order`, `categoryId?` | Groups within layers   |
| `PlacedStructure` | `orgLayerId`, `orgGroupId` (+ existing fields)            | Organization references          |

#### Default layer

A single "Default" layer (`layer-default`) is created on app start and after NEW_PROJECT. Users can create additional layers as needed.

#### Auto-assignment on placement

When placing a structure:

1. Structure is assigned to the **active layer** (`activeLayerId` in state)
2. `groupId` is set to `null` (no group by default)
3. Users can organize structures into groups manually via the LayerPanel

#### Visibility and interactivity rules

| Condition               | Visible | Interactive (selectable/erasable) |
| ----------------------- | ------- | --------------------------------- |
| Layer visible, unlocked | ✅      | ✅                                |
| Layer visible, locked   | ✅      | ❌                                |
| Layer hidden            | ❌      | ❌                                |
| Group hidden            | ❌      | ❌                                |
| Group locked            | ✅      | ❌                                |

**Important**: Collision detection remains **global** across all layers (hidden/locked structures still block placement).

#### Layer behaviors

- **Active layer selection**: There's always one layer selected (`activeLayerId`). Clicking a layer selects it; it cannot be deselected.
- **Auto-select on create**: Creating a new layer or group automatically selects it.
- **Locked layer protection**: Locked layers cannot be deleted (delete button is hidden, reducer guards against the action).
- **Persistence**: `activeLayerId` is saved in project files and restored on load.

#### UI components

- `LayerPanel.tsx`: Tree view with layers → groups → items
- Actions: Create/rename/delete layers and groups, toggle visibility/lock, drag-reorder layers
- Header controls: Toggle all visible, toggle all locked, collapse/expand all
- Add layer: `+` button reveals input form; Add group button hidden when layer is locked

#### Persistence

Project file format v4 includes:

```typescript
{
  version: 4,
  // ... existing fields ...
  userLayers: SerializedUserLayer[],
  userGroups: SerializedUserGroup[],
  activeLayerId: string | null,  // Persisted active layer selection
  structures: [{
    // ... existing fields ...
    orgLayerId: string,
    orgGroupId: string | null,
  }]
}
```

Migration from v3: A single "Default" layer is created, all structures get `orgLayerId: 'layer-default'`.

### "Source of truth" pointers

- **Product/behavior spec**: `docs/USE_CASES.md`
- **Project facts & decisions**: `docs/CONSTITUTION.md`
- **Configuration**: `package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `.prettierrc`
- **Entry point(s)**: `index.html`, `src/main.tsx`, `src/App.tsx`, `src/features/planner/PlannerPage.tsx`
- **Shared UI components**: `src/components/` (barrel export at `src/components/index.ts`)
- **Core domain logic**: `src/features/planner/state/reducer.ts`, `src/features/planner/canvas/renderer.ts` (includes `COLORS` constant, grid/center lines, hull/structure rendering), `src/data/types.ts`
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
  - Shared UI components live under `src/components/` (e.g., `Select`).
  - Shared "domain" data/types live under `src/data/`.
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
    CSS uses `input:checked + .checkboxIndicator` to style the checked state. See `LayerPanel.module.css` for examples.
  - **Custom Select component**: Use `<Select>` from `@/components` instead of native `<select>` for full styling and keyboard navigation control. See `src/components/Select/` for implementation.
  - **Toggle buttons**: For binary toggles in toolbars (like Grid visibility), use the `ToolButton` component pattern with `data-active` attribute instead of checkboxes. This provides consistent sizing and styling with other tool buttons.
- **State management**: reducer + Context (`PlannerProvider` / `usePlanner*` hooks); update state only via `PlannerAction`.
  - **Catalog state**: `PlannerState` includes `catalog` and `catalogStatus` (source, isParsing, lastUpdatedAt, lastError, jarFileName).
  - **Catalog load hook**: `useCatalogRefresh` loads cached user-uploaded JAR catalog on mount (if present) and otherwise ensures the built-in snapshot is active.
  - **Local UI state**: Purely presentational state (e.g., search queries, transient UI modes) should use local `useState` in components rather than polluting global `PlannerState`. Examples: `Palette.tsx` keeps search query local; `CanvasViewport.tsx` keeps drag-selection + pending erase confirmation local.
- **Form controls**:
  - Checkboxes: Use the custom checkbox pattern (hidden native + styled span indicator) for settings panels
  - Toggle buttons: For toolbar toggles (e.g., Grid visibility), use `ToolButton` with `data-active` attribute for consistent styling
  - Selects: Use the custom `<Select>` component from `@/components` (not native `<select>`) for full styling control and keyboard navigation
  - Inputs: Use CSS variables from `global.css` for consistent styling
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
  - **Rendering order matters**: `renderScene()` draws in strict order: background → grid → center lines → hull → structures → previews. Adding new visual elements requires placing them in the correct z-order.
  - **Preset changes don't prune structures**: switching canvas size keeps existing placements; some may end up out of bounds (see UC-082).
  - **Autosave key**: `space-haven-planner-autosave` (see `src/features/planner/hooks/useAutosave.ts`).
  - **JAR catalog cache key**: `space-haven-planner-jar-catalog` (see `src/data/jarCatalog/cache.ts`).
  - **Project JSON versioning**: current format is **v4**; loader migrates v1→v4 (see `src/lib/serialization/project.ts`). Migration adds `orgLayerId`/`orgGroupId` to structures and default user layers.
  - **Unknown structure IDs in loaded projects**: they'll deserialize, but won't render (and won't collide / be erasable) because lookups fail.
  - **Interaction hit-testing**: for selection/erase, prefer tile-level footprints (includes `construction` + `blocked` + `access`) via `getStructureTiles(...).all` in `src/features/planner/state/reducer.ts`. Size-only bounding boxes can miss tiles when a `tileLayout` is present.
  - **DPR scaling**: canvas uses `window.devicePixelRatio` for crisp rendering on HiDPI displays; coordinate math must account for this in `renderer.ts`.
  - **JAR structure IDs**: Use `mid_XXX` format (e.g., `mid_120` for X1 Airlock). These differ from old wiki-derived IDs.
  - **Space restrictions for airlocks/cargo ports**: These structures have large "Space" restriction areas that define where space must be. All Space restriction tiles are included (not just adjacent ones) and rendered as red blocked areas.
  - **Gap filling in structures**: The converter fills gaps within the core bounding box to ensure solid rectangles. Without this, structures like airlocks would appear as scattered tiles.
  - **FloorDeco tiles**: Treated as `access` tiles (crew can walk on them), not `construction`. This affects collision and rendering.
- **Missing imports cause runtime crashes**: TypeScript may not catch all missing imports (especially when functions are exported from barrel files). If the app crashes with `ReferenceError: Can't find variable: X`, check that the function is imported in the file using it. Example: `canPlaceAt` must be imported from `../state` in `CanvasViewport.tsx`.
- **JAR category IDs are not sequential**: The JAR uses non-sequential category IDs (e.g., 1506, 1507, 1508, 1516, 1519, 1522, 2880, 3359, 4243). Do NOT assume sequential IDs when mapping categories.
  - **Category display order is descending**: The game displays categories with higher `order` values first (leftmost). This is counterintuitive but matches the game UI.
  - **Duplicate `JAR_CATEGORY_MAP`**: The category mapping exists in TWO files: `src/data/jarCatalog/converter.ts` (for runtime JAR uploads) and `scripts/generate-jar-catalog.ts` (for snapshot generation). **Always update both** when changing categories, colors, or exclusions.
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

| JAR SubCat ID | Name TID | Game Name    | Internal ID    | JAR Order | Status    |
| ------------- | -------- | ------------ | -------------- | --------- | --------- |
| 4243          | 8018     | MISSION      | —              | 20        | ❌ Excluded |
| 1520          | 883      | WEAPON       | `weapon`       | 13        | ✅ Included |
| 1519          | 882      | SYSTEM       | `system`       | 10        | ✅ Included |
| 2880          | 4345     | ROBOTS       | `robots`       | 10        | ✅ Included |
| 1521          | 884      | AIRLOCK      | `airlock`      | 9         | ✅ Included |
| 1517          | 877      | STORAGE      | `storage`      | 8         | ✅ Included |
| 1515          | 879      | FOOD         | `food`         | 7         | ✅ Included |
| 1510          | 870      | RESOURCE     | `resource`     | 6         | ✅ Included |
| 1516          | 878      | POWER        | `power`        | 5         | ✅ Included |
| 1508          | 869      | LIFE SUPPORT | `life_support` | 4         | ✅ Included |
| 1507          | 868      | FACILITY     | `facility`     | 3         | ✅ Included |
| 3359          | 5127     | DECORATIONS  | `decorations`  | 2         | ✅ Included |
| 1506          | 867      | FURNITURE    | `furniture`    | 2         | ✅ Included |
| 1522          | 885      | WALL         | `wall`         | 1         | ✅ Included |

The "Other" category exists as a fallback but should remain empty if all OBJECTS SubCats are mapped.

#### Excluded categories

Some JAR categories are intentionally excluded from the planner:

| Category ID | Name    | Reason                                              |
| ----------- | ------- | --------------------------------------------------- |
| 4243        | MISSION | Mission-specific items not useful for ship planning |

To exclude a category, add its ID to `EXCLUDED_CATEGORY_IDS` in both:
- `src/data/jarCatalog/converter.ts`
- `scripts/generate-jar-catalog.ts`

Then regenerate the built-in snapshot.

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

### Item colors

All items within a category share the same color (the category's color). This is defined in `JAR_CATEGORY_MAP`:

| Category     | Color     | Hex       |
| ------------ | --------- | --------- |
| Wall         | Dark blue | `#3a4a5c` |
| Furniture    | Tan       | `#aa8877` |
| Decorations  | Mauve     | `#aa7788` |
| Facility     | Steel     | `#6688aa` |
| Life Support | Teal      | `#44aa88` |
| Power        | Orange    | `#cc8844` |
| Resource     | Amber     | `#aa8844` |
| Food         | Green     | `#66aa44` |
| Storage      | Olive     | `#888866` |
| Airlock      | Purple    | `#8866aa` |
| System       | Red       | `#cc4444` |
| Robots       | Cyan      | `#55aaaa` |
| Weapon       | Pink      | `#cc4466` |

To change a category's color, update `JAR_CATEGORY_MAP` in both converter files and regenerate the snapshot.

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
- **Layer (system)**: game-aligned visibility grouping (`Hull | Rooms | Systems | Furniture`); used for render ordering.
- **UserLayer**: CAD-style user-defined layer for organization; controls visibility and lock state.
- **UserGroup**: CAD-style group within a layer; organizes structures by category or custom grouping.
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
  - Shared UI components (reusable across features): `src/components/`
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
  - [ ] `pnpm build` (catches TypeScript errors and missing imports)
  - [ ] If changing the project file format: bump/migrate `PROJECT_VERSION` and keep load backward-compatible
  - [ ] If changing JAR parsing: update tests in `parser.test.ts` and `converter.test.ts`
  - [ ] If changing tile layout logic: regenerate `builtinSnapshot.ts` and verify structures render correctly
  - [ ] If changing category mapping: update both `converter.ts` AND `scripts/generate-jar-catalog.ts` (they have duplicate `JAR_CATEGORY_MAP`)
