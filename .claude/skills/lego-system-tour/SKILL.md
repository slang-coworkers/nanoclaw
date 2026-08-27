---
name: lego-system-tour
license: MIT
description: "Tour of the NanoClaw lego coworker composition system — spines, types, skills, workflows, overlays, and the composer that assembles them into CLAUDE.md. Includes the full record of the May 2026 refactor pass (21-scenario walkthrough + composer fixes + signal restoration). Use when revising the lego registry, debugging why a coworker's CLAUDE.md looks the way it does, or onboarding to the system."
---

# /lego-system-tour — NanoClaw Lego Coworker Composition

A reference for the lego coworker model — what the building blocks are, how the composer assembles them, what changed in the May 2026 refactor, and how to verify changes.

## When to use this skill

- Adding a new coworker type, workflow, overlay, or skill — make sure you follow the established patterns
- Debugging unexpected CLAUDE.md output — trace which fragment / type / overlay produced it
- Reviewing why a particular invariant or rule appears in one coworker but not another
- Bringing a new contributor up to speed on what the spine system is and how it composes

## The six building blocks

| Block | Lives in | What it is |
|---|---|---|
| **Spines** | `container/spines/{base,nanoclaw,slang,slangpy}/` | Identity, invariants, context fragments — verbatim Markdown, loaded into CLAUDE.md |
| **Coworker types** | `container/spines/*/coworker-types.yaml` + `container/skills/*/coworker-types.yaml` | The registry. `extends` chains, `skills:` / `workflows:` / `overlays:` / `bindings:` |
| **Skills** | `container/skills/<name>/SKILL.md` | Slash-invoked utility bodies + tool allowlists. Loaded on demand |
| **Workflows** | `container/workflows/<name>/WORKFLOW.md` | Step-by-step procedures with named anchors. Embedded into CLAUDE.md at compose time |
| **Overlays** | `container/overlays/<name>/OVERLAY.md` | Splice extra steps **into** workflows at named anchors |
| **Composer** | `src/claude-composer/{types,registry,resolve,spine,legacy}.ts` | Reads everything above, returns the final CLAUDE.md text |

## Composer pipeline

```
container/{spines,skills,workflows,overlays}/
                  │
                  ▼
        registry.ts.readSkillCatalog()      ←── name-keyed map; throws on duplicates
                  │
                  ▼
        registry.ts.readCoworkerTypes()     ←── merges *.coworker-types.yaml
                  │
                  ▼
        resolve.ts.resolveCoworkerManifest(types, typeName, catalog, projectRoot, {cliScope})
                  │
                  │   walks `extends:` chain, accumulates invariants/context/skills,
                  │   filters context paths by cliScope, builds workflow entries
                  │   with prologue + steps + epilogue
                  ▼
        spine.ts.renderCoworkerSpine(...)   ←── returns the CLAUDE.md string
                  │
                  ▼
        groups/<folder>/CLAUDE.md
```

Composer features (May 2026):
- **`normalizeFragment(text, targetMin)`** — demotes H1/H2 in fragments so they nest correctly under their wrapper headings
- **cliScope filter** — drops `ncl-group.md` / `ncl-global.md` paths based on the agent's cli scope
- **Prologue extraction** — pulls text between a workflow's `# /name` heading and the first numbered step into CLAUDE.md
- **Epilogue extraction** — same for text after the last step (e.g. `## Mode invariants`)
- **Workflow-description label dedup** — `## How to Work` uses each workflow's first-sentence description rather than a per-trait map (avoids "Investigation / triage" duplicates)
- **Compact projects table** — flat-mode Main's `## Projects available` is a single 3-row table (was per-project H3 sections)

## Base spine layout (post-refactor)

```
container/spines/base/
├── identity/
│   ├── default-identity.md      ← `default` coworker (untyped fallback)
│   └── main-body.md             ← `main` (flat admin orchestrator)
├── invariants/                  ← all in base-common.invariants
│   ├── principles.md            ← Personality + plan-first/TodoWrite rule
│   ├── safety.md                ← Safety rules
│   ├── truthfulness.md          ← (was inside safety.md) — Verify-with-proof rule added
│   ├── scope.md                 ← (was inside safety.md) — Simplicity-first + ask-if-hacky
│   ├── formatting.md            ← (was inside operations.md)
│   ├── packages.md              ← (was inside operations.md) — request_restart expanded
│   └── clock.md                 ← (was inside operations.md)
├── context/
│   ├── workspace.md             ← `/workspace/` mounts; reading INDEX.md reminder
│   ├── learnings.md             ← (extracted from workspace.md) — IMPORTANT call-out
│   ├── invocation.md            ← Workflow / overlay / subagent rules
│   ├── chain-reporting.md       ← `### Reporting upstream` + `### Outcome line`
│   └── (no orphans)
├── tool-instructions/           ← only loaded by `main` (flat) coworker
│   ├── core.md                  ← `## Sending messages` (canonical home; absorbed mid-turn-notifications)
│   ├── agents.md                ← create_agent + ephemeral Agent table; absorbed build/compile delegation
│   ├── wire-agents.md           ← NEW; admin-only peer-to-peer wiring
│   ├── interactive.md           ← ask_user_question vs send_card (table)
│   ├── self-mod.md              ← install_packages + add_mcp_server (admin-approval)
│   ├── scheduling.md            ← schedule_task + new_session=true default
│   ├── ncl-group.md             ← group-scope ncl reference (typed coworkers)
│   └── ncl-global.md            ← global-scope ncl reference (Main / owner agents)
└── coworker-types.yaml          ← base-common, main, default
```

## Project spine pattern

Each project (`nanoclaw`, `slang`, `slangpy`) follows the same shape:

```
container/spines/<project>/
├── identity/<role>.md           ← engineer / compiler-engineer
├── invariants/
│   ├── public-api.md            ← universal facts (slim — applies to readers too)
│   └── code-changes.md          ← writer/reviewer-only rules (one-thing-per-PR, tests must pass, etc.)
├── context/
│   ├── layout.md                ← repo map (universal)
│   └── skill-discovery.md       ← `gh skill` install commands (writer-only context)
└── coworker-types.yaml          ← <project>-common + reader/writer/reviewer/etc.
```

Inheritance (slang-* example):
```
base-common ──→ slang-common ──→ slang-reader ──┬─→ slang-maintainer
                                                ├─→ slang-triage
                                                ├─→ slang-reviewer
                                                └─→ slang-discord
                                ──→ slang-writer ─→ slang-fixer
```

`code-changes.md` lands in `*-writer.invariants` (cascades to fixer via `extends`) and `*-reviewer.invariants` (explicit, since reviewer extends reader). `skill-discovery.md` lands in `*-writer.context` only.

## Workflows (14 total, May 2026)

| Workflow | Extends | Steps | Notable shape |
|---|---|---|---|
| `plan` | — | 6 | Universal planning workflow. Step 2 = Recall (subagent reads INDEX.md). |
| `implement` | — | 6 | Universal implement workflow. Step 1 Setup = worktree-per-issue. |
| `nanoclaw-plan` | `plan` | inherits 6 | Project-specific Research overrides (parallel local + DeepWiki) |
| `nanoclaw-implement` | `implement` | inherits 6 | Augmented overrides preserve parent rules + add nanoclaw specifics |
| `nanoclaw-pr-review` | — | 5 | Devin Review runner; epilogue with Constraints + Failure modes |
| `slang-plan` | `plan` | inherits 6 | Same shape as nanoclaw-plan |
| `slang-implement` | `implement` | inherits 6 | Rich override for 15-25min builds (watchdog pattern) |
| `slang-fix-issue` | `implement` | 8 | Bucket 3 IMPORTANT prologue ("autonomous bug fixing"); active-work sentinel |
| `slang-pr-review` | — | 6 + epilogue | Two-reviewer parallel orchestration (Reviewer A + Devin) |
| `slang-triage-issue` | — | 7 | 1-6 sync + 7 async (when fixer reports back) |
| `slang-discord-answer` | — | 6 + epilogue | Discord forum-thread response flow |
| `slang-maintain` | — | 5 | Recurring sweeps (daily-report, release-notes, etc.) |
| `slangpy-plan` | `plan` | inherits 6 | |
| `slangpy-implement` | `implement` | inherits 6 | |

Every workflow gets a **Step 2 Recall** (subagent reads `/workspace/shared/learnings/INDEX.md` for prior hits) — added universally in May 2026.

## Overlays (3 total)

| Overlay | Targets | Behavior |
|---|---|---|
| **`critique-overlay`** | `plan` + `implement` workflows | Splices `⟐ ... GATE` blocks at `diagnose`, `change`, `deliver` anchors. Synchronous, blocks workflow. |
| **`buddy-monitor`** | `plan` + `implement` workflows | Splices an "invoke /buddy at session start" reminder before `understand` / `setup`. The actual buddy mechanism is async (background Agent + JSONL tail + UserPromptSubmit hook). |
| **`slang-discord-answer-critique`** | `slang-discord-answer` workflow | Targeted critique for Discord answers |

Overlays activate per-coworker via `agent_groups.overlays` JSON column. They compose without conflict — different anchors, additive splices. See `/tmp/claude-md-scenarios/18b-slang-writer-with-critique-and-buddy.md` for both layered.

## Render script + 21 scenarios

```bash
pnpm exec tsx scripts/render-all-claude-mds.ts                 # writes to /tmp/claude-md-scenarios/
pnpm exec tsx scripts/render-all-claude-mds.ts --suffix=_new   # writes <name>_new.md alongside originals for diffing
```

Scenario tiers:
- **Tier 1 (1-2)**: `default` (untyped), `main` (flat admin)
- **Tier 2 (3-5)**: readers — `nanoclaw-reader`, `slang-reader`, `slangpy-reader`
- **Tier 3 (6-8)**: writers — `nanoclaw-writer`, `slang-writer`, `slangpy-writer`
- **Tier 4 (9-14)**: specialty types — `slang-maintainer`, `slang-triage`, `slang-fixer`, `slang-reviewer`, `slang-discord`, `nanoclaw-reviewer`
- **Tier 5 (15-21 + 18b)**: slang-writer runtime variants — baseline, `disableOverlays`, `+critique-overlay`, `+buddy-monitor`, `+critique+buddy`, `cli=disabled`, `cli=global`, `+extraInstructions`

The `_new.md` suffix is for visual diffing; not committed.

## May 2026 refactor — what changed

### Composer (`src/claude-composer/`)
- Added `normalizeFragment(text, targetMin)` to demote H1/H2 in fragments
- Added cliScope filter for `ncl-group.md` / `ncl-global.md`
- Added workflow prologue + epilogue extraction
- Replaced TRIGGER_MAP with first-sentence-of-description for `## How to Work` labels
- Replaced per-project H3 sections with a single 3-row table for `## Projects available`
- Consolidated duplicate `## Skills` / `## Skills Available` into a single trait-categorized list
- Stripped `---` horizontal-rule separators in flat-mode joining
- Fixed `renderStepBlock` to handle empty firstLine + bolded-title duplicates from override bodies
- Fixed `parseStagedOverlay` blank-line cleanup for stage labels
- Fixed prologue H1 strip to match any `# Title` (not just `# /name`)

### Base spine (`container/spines/base/`)
- Split `safety.md` → `safety.md` + `truthfulness.md` + `scope.md`
- Split `operations.md` → `formatting.md` + `packages.md` + `clock.md`
- Extracted `learnings.md` from `workspace.md` (with IMPORTANT callout)
- Created `ncl-group.md` + `ncl-global.md` (cliScope-filtered)
- Created `wire-agents.md` (admin-only peer wiring fragment)
- Strengthened `principles.md` with Plan-first/TodoWrite rule
- Strengthened `truthfulness.md` with verify-with-proof rule
- Strengthened `scope.md` with simplicity-first + ask-if-hacky
- Strengthened `learnings.md` with on-correction trigger
- Added `### Outcome line` section to `chain-reporting.md`
- Rewrote `main-body.md` (Tools table, no parent escalation, Engineering Discipline section)
- Rewrote tool-instruction fragments for signal density

### Project spines
- Deleted orphans: `slang/identity/compiler.md`, `slang/invariants/public-api.md` (signal restored to slang `code-changes.md`)
- Trimmed identity tail principles in `slang/compiler-engineer.md` and `slangpy/engineer.md`
- Added language-semantics topics (autodiff, generics, capabilities) to slang identity
- Created `code-changes.md` for nanoclaw/slang/slangpy — writer/reviewer-only rules
- Moved `skill-discovery.md` from `*-common.context` to `*-writer.context`
- Trimmed `skill-discovery.md` content to 7 lines from 23

### Workflows
- Added Step 2 Recall (subagent for prior learnings) to all 14 workflows
- Added worktree-per-issue rule to `/implement` Setup
- Rewrote `slang-fix-issue` (10→8 steps, pytest→slang directives, Bucket 3 IMPORTANT prologue)
- Tightened `slang-triage-issue` (9→7 steps)
- Tightened `slang-pr-review` (9→6 steps, A/B notes moved to epilogue)
- Tightened `slang-discord-answer` (7→6 steps, Step 6+7 merged)
- Augmented `nanoclaw-implement` overrides to preserve parent engineering rules
- Restored "Follow existing style" + "review-feedback before re-running" to `slang-implement` and `slangpy-implement`

### Skills
- Added `mcp__nanoclaw__send_file`, `add_reaction`, `install_packages`, `add_mcp_server`, `request_restart`, `report_pr_created` to `base-nanoclaw.allowed-tools`
- Added `buddy` to `base-common.skills` (so `/buddy` is reachable from every typed coworker)
- Wired `buddy-monitor` overlay anchors (`insert-before: [understand, setup]`)

### Coworker-types.yaml updates
- `base/coworker-types.yaml`: split files, ncl integration, buddy added, `tool-instructions/core.md` reordered first
- `nanoclaw/coworker-types.yaml`: writer + reviewer get `code-changes.md` invariant
- `slang/coworker-types.yaml`: skill-discovery moved to writer; code-changes added to writer + reviewer
- `slangpy/coworker-types.yaml`: deduplicated, restructured; `public-api.md` reference removed (file deleted)

### Surprises resolved
- **SURPRISE 1** (`disableOverlays` is a no-op): documented as expected behavior. The flag has effect only when overlays exist in the type chain or runtime overlays.
- **SURPRISE 2** (`buddy` overlay not in catalog): name mismatch (`buddy-monitor` vs `buddy`) + empty splice anchors. Fixed: anchors set, test scenario renamed, base-common skills updated.
- **SURPRISE 3** (`cliScope` produced no diff): wired `ncl-group.md` / `ncl-global.md` fragments + composer-level filter. Three distinct outputs now: disabled (15,927) / group (17,436) / global (18,327).

## Key patterns established

1. **Reader/writer split via `code-changes.md`** — the universal `*-common.invariants` only carries facts that apply to all roles. Writer-territory rules (PR scope, migrations, tests-must-pass) go in `code-changes.md` which is added to writer + reviewer only.

2. **Orphan audit before deletion** — when removing a fragment, enumerate every original bullet and confirm where it lands (moved to X / already covered by Y / intentionally dropped because Z). The user pushed back when I dropped 3 slang bullets in the public-api.md cleanup; restored to `code-changes.md`.

3. **Composer-first fixes ripple** — adding to a base fragment hits every typed coworker. Adding to `*-writer` hits writer + fixer (slang only) via inheritance. Use the lowest-common-ancestor that needs the change.

4. **High-signal, low-token rewriting** — verbose prose → tables; per-trait labels → workflow-description first sentence; multi-paragraph quietness rules → one-line reference to the universal `### Reporting upstream` invariant.

5. **Workflow bodies embed completely** — prologue (before first step) + steps + epilogue (after last step) all render. Don't hide context outside the steps thinking the composer ignores it.

## How to verify

```bash
# Build cleanly
pnpm exec tsc --noEmit

# Type registry validation (CI runs this)
npm run validate:templates

# Re-render all 21 scenarios
pnpm exec tsx scripts/render-all-claude-mds.ts --suffix=_new

# Diff a specific scenario against committed baseline
diff /tmp/claude-md-scenarios/<name>.md /tmp/claude-md-scenarios/<name>_new.md

# Vitest run (full suite)
pnpm exec vitest run
```

`validate:templates` is the green-light gate. If it passes, the registry is internally consistent: every type's references resolve, no name collisions across catalog, every fragment file exists.

## Files modified or added in May 2026

Quick checklist for review:
- `container/spines/base/{identity,invariants,context,tool-instructions}/*.md` — refactored
- `container/spines/nanoclaw/invariants/code-changes.md` — added
- `container/spines/slang/invariants/code-changes.md` — added
- `container/spines/slangpy/invariants/code-changes.md` — added
- `container/spines/slang/identity/compiler.md` — deleted
- `container/spines/slang/invariants/public-api.md` — deleted
- `container/spines/slangpy/invariants/public-api.md` — deleted
- All `*/coworker-types.yaml` updated
- All 14 `container/workflows/*/WORKFLOW.md` got Step 2 Recall + tightening
- `container/overlays/buddy/OVERLAY.md` — anchors wired + body tightened
- `container/skills/base-nanoclaw/SKILL.md` — allowed-tools expanded
- `src/claude-composer/{types,registry,resolve,spine}.ts` — composer features
- `scripts/render-all-claude-mds.ts` — render script (added)

## See also

- `docs/lego-coworker-workflows.md` — the original architecture spec
- `CLAUDE.md` — project-level overview
- `/tmp/claude-md-scenarios/` — rendered scenarios for diff comparison (not committed)
