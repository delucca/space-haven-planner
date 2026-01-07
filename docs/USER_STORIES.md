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

- [ ] Planner loads immediately in-browser
- [ ] Choose canvas preset (1x1 .. 3x2)
- [ ] See structure palette, select structure, place on grid
- [ ] Autosave + restore from localStorage

**Should Have (v2):**

- [ ] “New project” to reset current plan
- [ ] Import from JSON or share link on first screen

**Could Have (Future):**

- [ ] Built-in templates (“starter ships”) to remix

**Won’t Have (Excluded):**

- [ ] Login / account creation

---

### Stage 3: First Value (Aha! Moment)

*The moment users experience core value*

**Must Have (MVP):**

- [ ] Place/erase structures with collision + bounds validation
- [ ] Rotate structures using keyboard (Q/E) before placing
- [ ] Export PNG and save JSON

**Should Have (v2):**

- [ ] Generate a shareable link (no server storage)

**Could Have (Future):**

- [ ] Fast “paint mode” for hull/walls with smart placement rules

**Won’t Have (Excluded):**

- [ ] Anything that slows time-to-first-layout (accounts, complex setup)

---

### Stage 4: Regular Use

*Ongoing usage for iteration and optimization*

**Must Have (MVP):**

- [ ] Layer visibility toggles (Hull / Rooms / Systems / Furniture)
- [ ] Category → layer auto-assignment (no manual layer picking for MVP)
- [ ] Move tool (pick up and reposition a placed structure)

**Should Have (v2):**

- [ ] Undo/redo
- [ ] Palette search/filter (“oxygen”, “bed”, “hangar”…)
- [ ] Multi-select + group move

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
- [ ] Export PNG for posting

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
- “Copy share link” UX (even before compression)

**Complex but critical:**

- Parsing structure data from the community wiki reliably (templates may change)
- Share link compression + versioning + URL length constraints
- Performance at large zoom with many placed tiles

**Defer with MVP fallback (not a code workaround):**

- Dynamic wiki catalog refresh → ship with a static catalog and optionally refresh it with caching (planner must work offline either way)

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

