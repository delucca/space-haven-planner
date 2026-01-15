# Space Haven Planner

A free, web-based ship layout planner for [Space Haven](https://bugbyte.fi/spacehaven/).

Plan your spacecraft designs before committing resources in-game. No accounts, no server—just open, design, and export.

---

## Quick Start

```bash
# Prerequisites: Node.js ^20.19.0 || >=22.12.0, pnpm
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Features

- **Tile-based grid** with preset canvas sizes (1×1 up to 3×2 / 2×3 units)
- **Structure catalog from Space Haven `spacehaven.jar`** (built-in snapshot + optional user import)
- **Collision detection** prevents overlapping placements
- **Rotation** (Q/E keys) with footprint-aware validation
- **CAD-style layers** with visibility, lock, and drag-reorder
- **Autosave** to localStorage—pick up where you left off
- **Export** as JSON (editable) or PNG (shareable)
- **Keyboard shortcuts**: 1/2/3/4 (Select/Hull/Place/Erase), Q/E (rotate), +/- (zoom), 0 (reset), Ctrl/Cmd+Z (undo), Escape (deselect)

---

## Documentation

| Document | Purpose |
|----------|---------|
| [`docs/KNOWLEDGE_BASE.md`](docs/KNOWLEDGE_BASE.md) | Architecture, workflows, conventions, gotchas |
| [`docs/CONSTITUTION.md`](docs/CONSTITUTION.md) | Project facts, domain model, decisions |
| [`docs/USE_CASES.md`](docs/USE_CASES.md) | Feature spec and use cases |
| [`docs/PMF.md`](docs/PMF.md) | Product-market fit narrative |
| [`docs/USER_STORIES.md`](docs/USER_STORIES.md) | User story map |
| [`AGENTS.md`](AGENTS.md) | AI agent collaboration protocols |

---

## Scripts

```bash
pnpm dev            # Start dev server
pnpm build          # Production build → ./dist
pnpm preview        # Serve production build locally
pnpm test           # Run tests (watch mode)
pnpm test:run       # Run tests once (CI)
pnpm lint           # ESLint check
pnpm format         # Prettier format
```

---

## Tech Stack

- **React 19** + **TypeScript**
- **Vite 7** (SPA build)
- **Canvas 2D** for rendering
- **Vitest** + **Testing Library** for tests
- **ESLint** + **Prettier** for code quality

---

## License

MIT License (see `LICENSE`).

This is an unofficial fan project. "Space Haven" is a trademark of Bugbyte Ltd.

---

## Support

If you find this tool useful:
- Use the in-app **Feedback** button to suggest features or report issues
- Consider [buying me a coffee](https://buymeacoffee.com/spacehavenplanner) ☕


