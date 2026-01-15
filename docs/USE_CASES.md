# Space Haven Planner - Use Cases & Features

## Overview
A tile-based ship design tool for planning Space Haven spacecraft layouts before building in-game.

**This document is the canonical behavior spec** and should match the current implementation under `src/`.
Use cases marked **(Planned)** are not implemented yet.

---

## Grid & Canvas Management

### UC-001: Select Canvas Preset
- **Action:** User selects a canvas size from the dropdown (1x1, 2x1, 1x2, 2x2, 3x1, 1x3, 3x2, 2x3)
- **Expected:** Grid resizes to the corresponding tile dimensions
- **Dimensions:** Each grid unit = 27 tiles (e.g., 2x2 = 54×54 tiles)

### UC-002: Adjust Zoom Level
- **Action:** User clicks +/- buttons, types a percentage in the zoom input, or uses keyboard shortcuts (`+/-`, `0` to reset)
- **Expected:** Grid tile size changes, all placed structures scale proportionally
- **Expected:** Zoom is displayed as a percentage where **100% = fit-to-width**
- **Limits:** Zoom is clamped to **6–72 px per tile** (internal scale)

### UC-003: Toggle Grid Visibility
- **Action:** User toggles the "🔲 Grid" tool button
- **Expected:** Grid lines show/hide while structures remain visible

### UC-004: Pan/Scroll the Canvas
- **Action:** User scrolls the canvas container, or holds **Space** and drags
- **Expected:** Canvas pans without changing placements

---

## Structure Catalog (JAR-based)

> The planner ships with a built-in catalog snapshot derived from a reference `spacehaven.jar`, and can optionally use a user-imported `spacehaven.jar` to match the player's game version.

### UC-013: Load Built-in Catalog Snapshot (Offline)
- **Action:** User opens the planner while offline
- **Expected:** Palette loads using the built-in catalog snapshot (no “blank palette” failure mode)

### UC-014: Import Catalog from `spacehaven.jar`
- **Action:** User clicks “📦 Import JAR” and selects a valid `.jar` file (`spacehaven.jar`)
- **Expected:** App parses the JAR and updates the structure palette
- **Expected:** Parsed catalog is cached locally to avoid repeated uploads
- **Expected:** Status bar shows catalog source (built-in/user/cached) and a parsing indicator while importing

### UC-015: JAR Parse Failure Keeps Planner Usable
- **Action:** User selects a non-JAR file or JAR parsing fails
- **Expected:** Planner keeps the previous working catalog (built-in or last successful user import)
- **Expected:** User is informed non-intrusively (status bar warning), not blocked by modal errors

### UC-017: Reset to Built-in Catalog
- **Action:** User clicks “↩️ Reset Catalog” (only visible when a user JAR is active)
- **Expected:** Cached user catalog is cleared and the built-in snapshot becomes active again

### UC-018: Wiki Metadata is Supplemental (Optional)
- **Action:** User hovers a structure (palette/canvas) or views the right-panel “Placement” section
- **Expected:** Planner may show wiki links and extra metadata when available
- **Note:** The wiki is **not** used as a catalog source for sizes/categories

---

## Structure Selection (Palette)

### UC-010: Expand/Collapse Category
- **Action:** User clicks on a category header (e.g., "Power", "Life Support")
- **Expected:** Category expands to show items or collapses to hide them
- **Expected:** Arrow indicator changes (▶ collapsed, ▼ expanded)

### UC-011: Select Structure from Palette
- **Action:** User clicks on a structure item in the palette
- **Expected:** Item highlights as selected
- **Expected:** Tool automatically switches to "Place" mode
- **Expected:** Right panel “Placement” section shows structure info and current rotation

### UC-012: View Structure Dimensions
- **Action:** User views structure in palette
- **Expected:** Each structure displays its tile dimensions (e.g., "3×2") on the right side

### UC-016: Search Structures in Palette
- **Action:** User types a query in the palette search box
- **Expected:** While the query is non-empty, the palette switches from categorized sections to a flat list of matching structures only
- **Expected:** Matching is case-insensitive against structure name **or** category name (e.g., typing "Power" shows all items in the "Power" category)
- **Expected:** If no structures match, an empty-state message ("No matching structures") is displayed
- **Expected:** Clearing the search box returns the palette to the normal categorized view

---

## Structure Placement (Place Tool)

### UC-020: Place Single Structure
- **Action:** User selects a structure, then clicks on the grid
- **Expected:** Structure appears at clicked position if valid
- **Expected:** Structure does not appear if placement is invalid (collision or out of bounds)

### UC-021: Preview Ghost on Hover
- **Action:** User hovers over grid with a structure selected (Place mode)
- **Expected:** Semi-transparent preview shows at cursor position
- **Expected:** Preview is green/valid when placement is valid
- **Expected:** Preview is red/invalid when placement is invalid

### UC-022: Drag Rectangle (Place Tool)
- **Action:** User holds mouse button and drags across grid (Place mode)
- **Expected:** A selection rectangle appears while dragging; objects inside are highlighted
- **Expected (Release):** No changes are applied yet (future: multi-place actions)

### UC-023: Collision Detection
- **Action:** User attempts to place structure overlapping an existing one
- **Expected:** Placement is blocked
- **Expected:** Preview indicates invalid position

### UC-024: Boundary Detection
- **Action:** User attempts to place structure extending beyond grid edges
- **Expected:** Placement is blocked
- **Expected:** Preview indicates invalid position

### UC-025: Rotate Structure Before Placing (Q/E)
- **Action:** User selects a structure and presses Q/E before placing
- **Expected:** Placement preview rotates accordingly (90° steps)
- **Expected:** Rotated footprint uses correct dimensions (width/height swap for 90°/270°)
- **Expected:** Collision/bounds validation uses the rotated footprint

### UC-026: Rotate Without Breaking Placement Flow
- **Action:** User places structures, rotating occasionally
- **Expected:** Rotation changes apply immediately to subsequent placements
- **Expected:** Already-placed structures are unchanged unless explicitly moved/edited

---

## Selection & Movement (Select Tool)

### UC-027: Box-select Structures
- **Action:** User switches to Select tool and drags a rectangle on the canvas
- **Expected:** Interactive structures inside the rectangle become selected
- **Expected:** Right panel “Selected” section shows selection count and basic info

### UC-028: Move Selected Structures
- **Action:** User clicks and drags a structure (Select tool)
- **Expected:** If the structure is selected, all selected structures move together
- **Expected:** Invalid moves (collision/out of bounds) are blocked (preview shows invalid and release snaps back)

### UC-029: Multi-select Toggle (Shift+Click)
- **Action:** User holds Shift and clicks structures (Select tool)
- **Expected:** Structures are added/removed from the current selection

### UC-037: Delete Selected Structures (Delete/Backspace)
- **Action:** User presses Delete/Backspace when one or more structures are selected
- **Expected:** Confirmation dialog appears
- **Expected (Confirm):** Selected structures are removed
- **Expected (Cancel):** No changes made

---

## Hull Tool

### UC-033: Paint Hull Tiles (Drag Rectangle)
- **Action:** User switches to Hull tool and drags a rectangle
- **Expected:** Hull tiles are filled inside the rectangle on mouse release

### UC-034: Erase Hull Tiles (Shift+Drag)
- **Action:** User holds Shift while dragging in Hull tool
- **Expected:** Hull tiles inside the rectangle are erased on mouse release

### UC-035: Hull Auto-walls Rendering
- **Action:** User paints hull tiles
- **Expected:** Walls render automatically around the perimeter of hull tiles (visual-only; not separate objects)

---

## Structure Removal (Erase Tool)

### UC-030: Switch to Erase Tool
- **Action:** User clicks "🗑️ Erase" button (or presses `4`)
- **Expected:** Button highlights as active
- **Expected:** Cursor changes to crosshair over grid

### UC-031: Erase Single Structure
- **Action:** User clicks (or drags a 1×1 rectangle) over a placed structure (Erase mode)
- **Expected:** Confirmation dialog appears
- **Expected (Confirm):** Structure is removed from grid
- **Expected (Cancel):** No changes made

### UC-032: Drag to Erase Multiple
- **Action:** User holds mouse button and drags across grid (Erase mode)
- **Expected:** A selection rectangle appears while dragging; selected objects are highlighted
- **Expected (Release):** Confirmation dialog appears if the selection includes any structures
- **Expected (Release, Hull-only):** If the selection includes only hull tiles, deletion happens without confirmation

---

## Organization (User Layers & Groups)

> The planner provides a CAD-style organization model (**User Layers → User Groups → Structures**) for visibility/locking and structure organization in the right panel.
> Separately, each structure also has a game-aligned system `layer` (`Hull/Rooms/Systems/Furniture`) derived from its catalog category.

### UC-040: Select Active User Layer
- **Action:** User clicks on a layer name in the right panel
- **Expected:** Layer becomes highlighted as active
- **Expected:** New placements are assigned to this active layer (organization)

### UC-041: Toggle Layer/Group Visibility
- **Action:** User clicks the “eye” icon next to a layer/group
- **Expected:** Structures in hidden layers/groups are not rendered
- **Expected:** Hidden structures are not interactive (cannot be selected/erased)

### UC-042: Toggle Layer/Group Lock
- **Action:** User clicks the “lock” icon next to a layer/group
- **Expected:** Locked structures remain visible but are not interactive (cannot be selected/erased)

### UC-043: Auto-group by Category on Placement
- **Action:** User places a structure while a layer is active and no group is selected
- **Expected:** Planner creates (or reuses) a group named after the structure’s category within the active layer and assigns the new structure to that group
- **Note:** Collision detection remains global; hidden/locked structures still block placement

---

## File Operations

### UC-050: Save Project as JSON
- **Action:** User clicks "💾 Save" button
- **Expected:** Browser downloads a `.json` file named `spacehaven-ship.json`
- **Expected:** JSON contains: version, gridSize, preset, structures, hullTiles, and organization state (userLayers/userGroups/activeLayerId)

### UC-051: Load Project from JSON
- **Action:** User clicks "📂 Load" button and selects a valid JSON file
- **Expected:** Grid resizes to saved dimensions
- **Expected:** All saved structures and hull tiles appear on grid
- **Expected:** Canvas preset selector updates to match saved preset

### UC-052: Load Invalid File
- **Action:** User attempts to load a non-JSON or malformed file
- **Expected:** Error alert displays with message

### UC-053: Export as PNG
- **Action:** User clicks "🖼️ Export PNG" button
- **Expected:** Browser downloads a `.png` image named `spacehaven-ship.png`
- **Expected:** Image shows grid lines and all visible structures (with labels)
- **Expected:** Image uses fixed scale (**20px per tile**) regardless of current zoom

### UC-054: Clear All Structures
- **Action:** User clicks "🗑️ Clear All" button
- **Expected:** Confirmation dialog appears
- **Expected (Confirm):** All structures and hull tiles are removed
- **Expected (Cancel):** No changes made

### UC-055: Autosave to Local Storage
- **Action:** User places/erases/moves/rotates structures or edits organization
- **Expected:** Planner automatically saves progress to localStorage (debounced, 1s delay)
- **Implementation:** Uses the same JSON format as manual save (current project version)

### UC-056: Restore Autosave on Reload
- **Action:** User refreshes the page or closes and reopens the site
- **Expected:** Planner restores the last autosaved project automatically

### UC-057: Clear Local Autosave
- **Action:** User clicks "📄 New" button
- **Expected:** Confirmation dialog appears if any structures or hull tiles exist
- **Expected (Confirm):** Local autosave state is cleared, planner returns to an empty canvas
- **Expected (Cancel):** No changes made

### UC-058: Create Shareable Link (Planned)
- **Action:** User clicks “Share” / “Copy link”
- **Expected:** Planner encodes the project into the URL (no server storage)
- **Expected:** Link can be copied to clipboard

### UC-059: Load from Shareable Link (Planned)
- **Action:** User opens a shared link
- **Expected:** Planner loads the encoded project automatically
- **Expected:** Invalid links fall back gracefully (show error + load empty or autosave)

---

## Status Bar

### UC-060: Display Cursor Coordinates
- **Action:** User hovers over grid
- **Expected:** Status bar shows "Cursor: X, Y" with current tile coordinates

### UC-061: Display Statistics & Catalog Status
- **Action:** User views status bar
- **Expected:** Shows structure count and grid dimensions
- **Expected:** Shows current catalog source (built-in/user/cached) and parsing/error indicators when applicable

### UC-062: Cursor Leaves Grid
- **Action:** User moves cursor off the grid area
- **Expected:** Status bar shows "Hover over grid to see coordinates"

---

## Keyboard Shortcuts

### UC-070: Tool Shortcuts (1–4)
- **Action:** User presses number keys
- **Expected:** Tool switches accordingly:
  - `1` = Select
  - `2` = Hull
  - `3` = Place
  - `4` = Erase

### UC-072: Press Q/E to Rotate
- **Action:** User presses `Q` or `E` while a structure is selected for placement
- **Expected:** Preview rotates 90° counter-clockwise (Q) or clockwise (E)
- **Expected:** Rotation persists for subsequent placements until changed

### UC-073: Press Escape to Deselect
- **Action:** User presses Escape key
- **Expected:** Current structure selection is cleared (palette selection + grid selection)

### UC-074: Undo/Redo
- **Action:** User presses `Ctrl/Cmd+Z` (undo) or `Ctrl+Y` / `Ctrl/Cmd+Shift+Z` (redo)
- **Expected:** Canvas + organization changes undo/redo

### UC-075: Zoom Shortcuts
- **Action:** User presses `+/-` to zoom, `0` to reset to fit-to-width
- **Expected:** Zoom updates accordingly

### UC-076: Pan Shortcut
- **Action:** User holds `Space` and drags
- **Expected:** Canvas pans

---

## Edge Cases

### UC-080: Place 1×1 Structure at Grid Edge
- **Action:** User places a 1×1 structure at position (gridWidth-1, gridHeight-1)
- **Expected:** Structure places successfully

### UC-081: Place Large Structure Near Edge
- **Action:** User attempts to place a large structure without enough space to the edge
- **Expected:** Placement is blocked, invalid preview shown

### UC-082: Change Canvas with Existing Structures
- **Action:** User changes canvas preset while structures are placed
- **Expected:** Grid resizes; existing structures are not auto-pruned (some may end up out of bounds)

### UC-083: Load File with Unknown Structure IDs
- **Action:** User loads JSON containing structure IDs not present in the current catalog
- **Expected:** Planner loads without crashing
- **Expected:** Unknown structures are not rendered (and do not affect collisions); they remain preserved in the project file data

---

## Data Integrity

### UC-090: Project JSON Structure Format (v4)
- **Expected structure (example):**
```json
{
  "version": 4,
  "gridSize": { "width": 54, "height": 54 },
  "preset": "2x2",
  "structures": [
    {
      "id": "1736150400000-abc1234",
      "structureId": "mid_2242",
      "categoryId": "system",
      "x": 10,
      "y": 5,
      "rotation": 0,
      "layer": "Systems",
      "orgLayerId": "layer-default",
      "orgGroupId": "1736150400000-def5678"
    }
  ],
  "hullTiles": [{ "x": 0, "y": 0 }],
  "userLayers": [
    { "id": "layer-default", "name": "Default", "isVisible": true, "isLocked": false, "order": 0 }
  ],
  "userGroups": [
    {
      "id": "1736150400000-def5678",
      "layerId": "layer-default",
      "name": "System",
      "isVisible": true,
      "isLocked": false,
      "order": 0,
      "categoryId": "system"
    }
  ],
  "activeLayerId": "layer-default"
}
```
- **Field notes:**
  - `version`: Current project format version (4). Loader supports migrating older versions.
  - `layer`: Game-aligned system layer derived from the catalog category (`Hull/Rooms/Systems/Furniture`).
  - `orgLayerId`/`orgGroupId`: User organization references (right-panel layers/groups).

### UC-091: Structure ID Uniqueness
- **Expected:** Each placed structure has a unique ID (timestamp + random suffix)

### UC-092: PNG Export Includes Only Visible Items
- **Expected:** Only structures in visible user layers/groups appear in exported PNG (hidden items are omitted)

---

## UI Responsiveness

### UC-100: Scroll Large Grid
- **Action:** User views a large grid at high zoom
- **Expected:** Canvas container scrolls horizontally and vertically

### UC-101: Palette Scroll
- **Action:** User expands many categories
- **Expected:** Left panel scrolls to show all structures

---

## Structure Catalog Coverage
- The number of structures and categories depends on the Space Haven version and which catalog source is active (built-in snapshot vs user-imported JAR).



