# Space Haven Planner - Use Cases & Features

## Overview
A tile-based ship design tool for planning Space Haven spacecraft layouts before building in-game.

---

## Grid & Canvas Management

### UC-001: Select Canvas Preset
- **Action:** User selects a canvas size from the dropdown (1x1, 2x1, 1x2, 2x2, 3x1, 1x3, 3x2, 2x3)
- **Expected:** Grid resizes to the corresponding tile dimensions
- **Dimensions:** Each grid unit = 27 tiles (e.g., 2x2 = 54×54 tiles)

### UC-002: Adjust Zoom Level
- **Action:** User drags the zoom slider (range: 6-24px)
- **Expected:** Grid tile size changes, all placed structures scale proportionally
- **Expected:** Zoom value displays next to slider

### UC-003: Toggle Grid Visibility
- **Action:** User checks/unchecks the "Grid" checkbox
- **Expected:** Grid lines show/hide while structures remain visible

---

## Structure Selection

### UC-010: Expand/Collapse Category
- **Action:** User clicks on a category header (e.g., "Power", "Life Support")
- **Expected:** Category expands to show items or collapses to hide them
- **Expected:** Arrow indicator changes (▶ collapsed, ▼ expanded)

### UC-011: Select Structure from Palette
- **Action:** User clicks on a structure item in the palette
- **Expected:** Item highlights green
- **Expected:** Tool automatically switches to "Place" mode
- **Expected:** Right panel "Selected" section shows structure name, size, and color preview

### UC-012: View Structure Dimensions
- **Action:** User views structure in palette
- **Expected:** Each structure displays its tile dimensions (e.g., "3×2") on the right side

---

## Structure Catalog (Future Enhancement)

> The current prototype uses a static, hardcoded structure catalog. The rewrite should support an optional dynamic refresh from the community wiki, with a static fallback so the app always works offline.

### UC-013: Load Built-in Structure Catalog
- **Action:** User opens the planner while offline
- **Expected:** Structure palette loads from the built-in catalog
- **Expected:** Planner remains usable (no “blank palette” failure mode)

### UC-014: Refresh Structure Catalog from Wiki
- **Action:** User opens the planner while online (or clicks a manual “Refresh Catalog” action)
- **Expected:** Planner fetches catalog updates from the Space Haven community wiki (MediaWiki API)
- **Expected:** Fetched data is cached locally to avoid repeated requests
- **Expected:** If fetch succeeds, palette updates without breaking existing projects

### UC-015: Wiki Fetch Failure Fallback
- **Action:** Wiki fetch fails (network error, rate limit, parsing failure)
- **Expected:** Planner falls back to built-in catalog automatically
- **Expected:** User is informed non-intrusively (small banner/toast), not blocked by modal errors

---

## Structure Placement

### UC-020: Place Single Structure
- **Action:** User selects a structure, then clicks on the grid
- **Expected:** Structure appears at clicked position if valid
- **Expected:** Structure does not appear if placement is invalid (collision or out of bounds)

### UC-021: Preview Ghost on Hover
- **Action:** User hovers over grid with a structure selected (Place mode)
- **Expected:** Semi-transparent preview shows at cursor position
- **Expected:** Preview is green-bordered if placement is valid
- **Expected:** Preview is red-bordered if placement is invalid

### UC-022: Drag to Place Multiple
- **Action:** User holds mouse button and drags across grid (Place mode)
- **Expected:** Structures place continuously where valid (useful for hull tiles)

### UC-023: Collision Detection
- **Action:** User attempts to place structure overlapping an existing one
- **Expected:** Placement is blocked
- **Expected:** Preview shows red indicating invalid position

### UC-024: Boundary Detection
- **Action:** User attempts to place structure extending beyond grid edges
- **Expected:** Placement is blocked
- **Expected:** Preview shows red indicating invalid position

### UC-025: Rotate Structure Before Placing (Q/E)
- **Action:** User selects a structure and presses Q/E (or equivalent UI control) before placing
- **Expected:** Placement preview rotates accordingly (90° steps)
- **Expected:** Rotated footprint uses correct dimensions (width/height swap for 90°/270°)
- **Expected:** Collision/bounds validation uses the rotated footprint

### UC-026: Rotate Without Breaking Placement Flow
- **Action:** User drags to place multiple structures, rotating occasionally
- **Expected:** Rotation changes apply immediately to subsequent placements
- **Expected:** Already-placed structures are unchanged unless explicitly edited

---

## Structure Removal

### UC-030: Switch to Erase Tool
- **Action:** User clicks "🗑️ Erase" button
- **Expected:** Button highlights as active
- **Expected:** Cursor changes to crosshair over grid

### UC-031: Erase Single Structure
- **Action:** User clicks on a placed structure (Erase mode)
- **Expected:** Structure is removed from grid

### UC-032: Drag to Erase Multiple
- **Action:** User holds mouse button and drags across grid (Erase mode)
- **Expected:** All structures under cursor path are removed

---

## Layer System

> Current prototype behavior: the “active layer” determines the layer assigned to new structures.  
> Planned rewrite behavior: structures default to a layer based on their category (Hull/Rooms/Systems/Furniture), and layers are primarily for visibility and organization.

### UC-040: Select Active Layer
- **Action:** User clicks on a layer name in right panel (Hull, Rooms, Systems, Furniture)
- **Expected:** Layer becomes highlighted as active
- **Expected:** New structures are assigned to this layer

### UC-041: Toggle Layer Visibility
- **Action:** User clicks checkbox next to layer name
- **Expected:** All structures on that layer show/hide
- **Expected:** Checkbox reflects current visibility state

### UC-042: Structures Inherit Active Layer
- **Action:** User selects "Systems" layer, then places a structure
- **Expected:** Placed structure is assigned to "Systems" layer
- **Expected:** Structure hides when "Systems" layer visibility is toggled off

### UC-043: Category → Layer Auto-Assignment (Planned)
- **Action:** User places a structure from a known category (e.g., Power)
- **Expected:** Structure is automatically assigned to its default layer (e.g., Systems)
- **Expected:** User does not need to manually select a layer for correct organization

---

## File Operations

### UC-050: Save Project as JSON
- **Action:** User clicks "💾 Save" button
- **Expected:** Browser downloads a `.json` file named `spacehaven-ship.json`
- **Expected:** JSON contains: version, gridSize, preset, and structures array

### UC-051: Load Project from JSON
- **Action:** User clicks "📂 Load" button and selects a valid JSON file
- **Expected:** Grid resizes to saved dimensions
- **Expected:** All saved structures appear on grid
- **Expected:** Canvas preset selector updates to match saved preset

### UC-052: Load Invalid File
- **Action:** User attempts to load a non-JSON or malformed file
- **Expected:** Error alert displays with message

### UC-053: Export as PNG
- **Action:** User clicks "🖼️ Export PNG" button
- **Expected:** Browser downloads a `.png` image named `spacehaven-ship.png`
- **Expected:** Image shows grid lines and all visible structures with labels
- **Expected:** Image uses fixed scale (20px per tile) regardless of current zoom

### UC-054: Clear All Structures
- **Action:** User clicks "🗑️ Clear" button
- **Expected:** Confirmation dialog appears
- **Expected (Confirm):** All structures removed from grid
- **Expected (Cancel):** No changes made

### UC-055: Autosave to Local Storage
- **Action:** User places/erases/moves/rotates structures
- **Expected:** Planner automatically saves progress to localStorage (debounced, 1s delay)
- **Expected:** No account is required
- **Implementation:** Uses same JSON format as manual save (v2)

### UC-056: Restore Autosave on Reload
- **Action:** User refreshes the page or closes and reopens the site
- **Expected:** Planner restores the last autosaved project automatically

### UC-057: Clear Local Autosave
- **Action:** User clicks "📄 New" button
- **Expected:** Confirmation dialog appears if structures exist
- **Expected (Confirm):** Local autosave state is cleared, planner returns to empty canvas
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

### UC-061: Display Statistics
- **Action:** User views status bar
- **Expected:** Shows structure count, active layer, and grid dimensions

### UC-062: Cursor Leaves Grid
- **Action:** User moves cursor off the grid area
- **Expected:** Status bar shows "Hover over grid to see coordinates"

---

## Keyboard Shortcuts

### UC-070: Press 1 for Place Mode
- **Action:** User presses '1' key
- **Expected:** Tool switches to Place mode

### UC-071: Press 2 for Erase Mode
- **Action:** User presses '2' key
- **Expected:** Tool switches to Erase mode

### UC-072: Press Q/E to Rotate
- **Action:** User presses 'Q' or 'E' while a structure is selected
- **Expected:** Preview rotates 90° counter-clockwise (Q) or clockwise (E)
- **Expected:** Rotation persists for subsequent placements until changed

### UC-073: Press Escape to Deselect
- **Action:** User presses Escape key
- **Expected:** Current structure selection is cleared

---

## Edge Cases

### UC-080: Place 1×1 Structure at Grid Edge
- **Action:** User places a 1×1 structure at position (gridWidth-1, gridHeight-1)
- **Expected:** Structure places successfully

### UC-081: Place Large Structure Near Edge
- **Action:** User attempts to place 4×5 Hyperdrive with only 3 tiles to edge
- **Expected:** Placement blocked, red preview shown

### UC-082: Change Canvas with Existing Structures
- **Action:** User changes canvas preset while structures are placed
- **Expected:** Grid resizes; structures outside new bounds may become inaccessible

### UC-083: Load File with Unknown Structure Keys
- **Action:** User loads JSON containing structure keys not in STRUCTURES object
- **Expected:** Unknown structures are ignored or handled gracefully

---

## Data Integrity

### UC-090: JSON Structure Format (v2)
- **Expected structure:**
```json
{
  "version": 2,
  "gridSize": { "width": 54, "height": 54 },
  "preset": "2x2",
  "structures": [
    {
      "id": "1736150400000-abc1234",
      "structureId": "system_core_x1",
      "categoryId": "power",
      "x": 10,
      "y": 5,
      "rotation": 0,
      "layer": "Systems"
    }
  ]
}
```
- **Field notes:**
  - `version`: Format version (currently 2). Loader supports v1 migration.
  - `id`: Unique string identifier (timestamp + random suffix).
  - `structureId`: Key referencing the structure definition in the catalog.
  - `categoryId`: Key referencing the category in the catalog.
  - `rotation`: Rotation angle in degrees (0, 90, 180, 270).
  - `layer`: Layer assignment (Hull, Rooms, Systems, Furniture).

### UC-091: Structure ID Uniqueness
- **Expected:** Each placed structure has a unique ID (timestamp + random)

### UC-092: PNG Export Includes All Visible Layers
- **Expected:** Only structures on visible layers appear in exported PNG

---

## UI Responsiveness

### UC-100: Scroll Large Grid
- **Action:** User views a 3x2 grid (81×54 tiles) at max zoom
- **Expected:** Canvas container scrolls horizontally and vertically

### UC-101: Palette Scroll
- **Action:** User expands all categories
- **Expected:** Left panel scrolls to show all structures

---

## Structure Categories Covered

| Category | Item Count | Example Structures |
|----------|------------|-------------------|
| Hull & Walls | 8 | Hull Tile, X1 Door, Window 3-tile |
| Power | 13 | System Core X1/X2/X3, Power Generators, Solar Panel |
| Life Support | 5 | Oxygen Generator, Gas Scrubber, Thermal Regulator |
| Systems & Combat | 15 | Hyperdrive, Shield Generator, Energy Turret |
| Airlock & Hangar | 4 | X1 Airlock, Pod Hangar, Shuttle Hangar |
| Storage | 7 | Small/Large Storage, Cargo Port |
| Food & Agriculture | 8 | Kitchen, Grow Beds, CO2 Producer |
| Resource & Industry | 15 | Recycler, Assembler, Refineries |
| Crew Facilities | 19 | Bed, Medical Bed, Research Lab, Arcade |
| Robots | 3 | Salvage/Logistics Robot Stations |
| Furniture & Decoration | 14 | Chair, Table, Light, Decorative items |

**Total: 111 structures**