# User Story Map — Space Haven Planner

## Personas

- **New player**: needs a simple way to understand structure sizes and plan a first ship without wasting in-game time.
- **Min-maxer**: optimizes layouts and wants fast iteration, keyboard controls, and shareable drafts.

---

## User Journey Stages

### Stage 1: Discovery

*How users find and understand the tool*

**Must Have (MVP):**

- [ ] Clear “unofficial fan tool” positioning and what it does in one screen
- [ ] One-click “Open Planner” (no signup)
- [ ] Example screenshot/GIF of placing and exporting

**Should Have (v2):**

- [ ] Short FAQ (offline-first, no accounts, how to share)
- [ ] Changelog link

**Could Have (Future):**

- [ ] Interactive tutorial overlay (first run)

**Won’t Have (Excluded):**

- [ ] Mandatory accounts / paywalls / gated access

---

### Stage 2: Start (No Signup)

*Getting users into the product instantly*

**Must Have (MVP):**

- [x] Planner loads immediately in-browser
- [x] Choose canvas preset (1x1 .. 3x2 / 2x3)
- [x] See structure palette, select structure, place on grid
- [x] Autosave + restore from localStorage

**Should Have (v2):**

- [x] “New project” to reset current plan
- [x] Import from JSON
- [ ] Share link entry point on first screen

**Could Have (Future):**

- [ ] Built-in templates (“starter ships”) to remix

**Won’t Have (Excluded):**

- [ ] Login / account creation

---

### Stage 3: First Value (Aha! Moment)

*The moment users experience core value*

**Must Have (MVP):**

- [x] Place/erase structures with collision + bounds validation
- [x] Rotate structures using keyboard (Q/E) before placing
- [x] Export PNG and save JSON

**Should Have (v2):**

- [ ] Generate a shareable link (no server storage)

**Could Have (Future):**

- [x] Fast “paint mode” for hull tiles (drag-to-fill + erase)

**Won’t Have (Excluded):**

- [ ] Anything that slows time-to-first-layout (accounts, complex setup)

---

### Stage 4: Regular Use

*Ongoing usage for iteration and optimization*

**Must Have (MVP):**

- [x] Layer/group visibility and lock toggles (user layers + groups)
- [x] Category → system-layer auto-assignment (Hull/Rooms/Systems/Furniture)
- [x] Move tool (pick up and reposition a placed structure)

**Should Have (v2):**

- [x] Undo/redo
- [x] Palette search/filter (“oxygen”, “bed”, “hangar”…)
- [x] Multi-select + group move

**Could Have (Future):**

- [ ] Measurements and heatmaps (walk distance overlays, etc.)

**Won’t Have (Excluded):**

- [ ] Accounts / cloud sync
- [ ] Dark patterns / ads that get in the way of planning

---

### Stage 5: Referral / Growth

*How users share layouts and spread the word*

**Must Have (MVP):**

- [ ] Shareable link that recreates the layout on open
- [x] Export PNG for posting

**Should Have (v2):**

- [ ] “Copy link” button + share hints (Discord/Reddit-friendly)

**Could Have (Future):**

- [ ] Optional public gallery (would require backend; only if worth it)

**Won’t Have (Excluded):**

- [ ] Anything that requires identity/accounts to share

---

## Technical Feasibility Notes

**Quick wins (build first):**

- Autosave/restore (localStorage)
- Category → layer mapping
- Rotation support in placement + preview
- "Copy share link" UX (even before compression)

**Complex but critical:**

- JAR file parsing for authoritative structure data (sizes, categories, names)
- Share link compression + versioning + URL length constraints
- Performance at large zoom with many placed tiles

**Catalog data strategy:**

- **Primary source**: User-uploaded `spacehaven.jar` or built-in JAR snapshot
- **Fallback**: Static hardcoded catalog (guaranteed offline functionality)
- **Supplemental**: Wiki metadata for images/descriptions (not for catalog building)
- JAR catalog is cached in localStorage with source info for persistence

---

## Success Metrics per Stage (No Accounts)

Because we don’t use accounts, “metrics” are mostly qualitative unless we add explicit, privacy-respecting telemetry.

| Stage | Metric | MVP Target | v2 Target |
|-------|--------|------------|-----------|
| Discovery | Users who open the planner after landing | High (qualitative) | Higher |
| Start | Time to first placed structure | < 1 minute | < 30 seconds |
| First Value | Successful export (PNG/JSON) or share link created | Common | Very common |
| Regular Use | Users returning with existing autosave | Common | Very common |
| Referral | Layouts shared in community posts | Some | Many |




