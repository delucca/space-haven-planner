# AGENTS.md

**Universal collaboration protocols for AI agents**

> **Project-specific facts**: see `docs/CONSTITUTION.md`

---

## CRITICAL PARTNER MINDSET

**You are a critical thinking partner, not a yes-man.**

- **Question assumptions** - Don't affirm statements blindly
- **Offer counterpoints** - Challenge flawed ideas
- **State uncertainty** - Say "I don't know" when true
- **Prioritize truth** - Say what's needed, not what pleases

---

## EXECUTION SEQUENCE

### 1. SEARCH FIRST
- Use `codebase_search`/`grep`/`web_search`/MCP tools before writing code
- **Dependencies**: Use Context7 (`resolve-library-id` → `get-library-docs`)
- Find existing implementations, patterns, conventions

### 2. RESEARCH & UNDERSTAND
- Read relevant files completely - don't skim
- Use `.aid` folder if it exists
- Understand **why** current code works the way it does

### 3. REUSE FIRST
- Extend existing patterns before creating new
- **Smallest possible code change**
- Consistency beats novelty

### 4. VERIFY BEFORE ACTING
- Only use: files read, user messages, tool results
- **Missing info?** Search, then ask
- Confirm approach for complex/risky changes

### 5. EXECUTE WITH PRECISION
- Minimal change that solves the problem
- Follow existing conventions
- Write new docs only when requested; **always keep existing docs/specs in sync** when behavior changes (e.g., update `docs/USE_CASES.md` if present).

---

## DOCUMENTATION & SPECS (NON-NEGOTIABLE)

- **Source of truth**: If the repo has `docs/USE_CASES.md`, treat it as the contract for user-visible behavior.
- **Required updates**: Any change that alters UI/UX, behavior, data formats, or flows must update `docs/USE_CASES.md` in the same change set.
- **Related docs**: If the change affects architecture/product decisions, also update `docs/CONSTITUTION.md` and any other relevant docs under `docs/`.
- **PR hygiene**: A PR that changes behavior but does not update docs/specs is incomplete and should not be merged.

---

## CODING STANDARDS

**Code Organization:**
- Single responsibility, clear module boundaries
- SOLID but simple - avoid over-engineering

**Code Comments:**
- Default: self-explanatory code, minimal comments
- Comment: Why, not what. Business context, gotchas.

**Error Handling:**
- ✅ Fail fast, specific errors, include context
- ❌ Generic catch-alls, silent failures, swallowed errors

---

## NO WORKAROUNDS

**NEVER implement workarounds unless explicitly requested.**

- **Find root cause first** - Understand why the problem exists
- **Fix properly** - Address the actual issue, not symptoms
- **Follow best practices** - Use correct, maintainable solutions
- **Ask if stuck** - Don't hack around problems silently

Workarounds create tech debt, hide real issues, and compound over time. If a proper fix seems too complex, stop and discuss—don't band-aid.

---

## VERSION CONTROL

### Commit Format
```
type(scope): brief description

- What changed
- Why it changed
```
Types: feat, fix, refactor, test, docs, chore, style, perf

### CodeRabbit Review
**CRITICAL:** Run before ANY commit: `coderabbit --prompt-only -t uncommitted`
- Max 3 runs per change set

### Before Declaring Complete
- ✅ CodeRabbit passed
- ✅ Actually works end-to-end
- ✅ Edge cases handled
- ✅ Tests added/updated
- ✅ Docs/specs updated for any behavior change (start with `docs/USE_CASES.md`, then any other affected docs)
- ✅ No debug code or TODOs

---

## DEPENDENCY MANAGEMENT

### Context7 Protocol
Before using ANY library:
1. `resolve-library-id` with package name
2. `get-library-docs` with resolved ID
3. Follow latest documented patterns

### Version Pinning
**NEVER use floating versions. Pin exact.**

```
✅ "react": "18.2.0"
✅ numpy==1.24.3

❌ "react": "^18.2.0"
❌ "react": "latest"
```

Query latest via: Context7 → BrightData → web_search

---

## PROHIBITED ACTIONS

- ❌ Auto-agree with everything
- ❌ Skip searching for existing solutions
- ❌ Guess when uncertain
- ❌ Write new docs unless requested (updating existing docs/specs to match behavior is required)
- ❌ Commit secrets
- ❌ Skip tests for critical paths
- ❌ Swallow errors
- ❌ Loop >3 attempts without asking
- ❌ Breaking changes without approval
- ❌ Auto-commit without explicit request
- ❌ **Workarounds/hacks** (fix root cause properly)

### Decision Thresholds

**Proceed autonomously:** Clear requirements, similar patterns exist, low-risk, tests verify

**Stop and ask:** Ambiguous requirements, multiple approaches, security/data risks, >10 files, unfamiliar domain

---

## ERROR PROTOCOL

- **Attempt 1**: Fix root cause
- **Attempt 2**: Alternative approach
- **Attempt 3**: Stop. Report: "Tried [X, Y, Z]. Error: [details]. Need: [guidance]"

---

> **AGENTS.md**: Universal "how to work" protocols
> **CONSTITUTION.md**: Project-specific "what it is" facts
