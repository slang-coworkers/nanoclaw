# Lego Coworker Workflows — Design

Successor to `v2-template-composition-design.md`. Restructures typed coworkers around three artifacts (spine, workflow, skill) with a thin always-in-context CLAUDE.md and progressive disclosure of procedural content.

## Problem

The current composer (`src/claude-composer.ts`) merges role templates across a type chain into a single monolithic CLAUDE.md pinned in every agent turn. For long-running coworkers this burns context on procedural detail (`workflow:`, `resources:`, half of `capabilities:`) that is only relevant when a specific task is running. The fixed 6-section model (`role / capabilities / workflow / constraints / formatting / resources`) conflates always-in-context identity with on-demand procedure — fine for small coworkers, broken for long-running ones with many responsibilities.

Meanwhile Claude Code's native **SKILL.md progressive disclosure** is already used for capability skills like `container/skills/slang-fix/SKILL.md` — body loads only when the skill is invoked. Workflows do not use this mechanism.

## Intent

Restructure into a lego model:

- Three typed artifacts with clear responsibilities.
- Thin, auto-generated CLAUDE.md (the **spine**) pinned in context.
- Workflows as first-class progressively-disclosed units that orchestrate skills.
- Filesystem + frontmatter as the contract for extensibility; no plugin API, no registry to edit.

## Three Artifacts

### Spine — always in context

Composed into CLAUDE.md on every container wake. Four sections, all small.

| Section | Merge mode | Content |
|---------|------------|---------|
| `identity` | leaf (last-wins across type chain) | Who this coworker is, domain, voice |
| `invariants` | append (dedup by content hash) | Guardrails that must always hold |
| `context` | append (dedup) | Domain facts (repo layout, conventions, canonical paths) |
| `index` | auto-generated | Catalog of workflows + skills with one-line descriptions and invocation paths |

No `workflow`, `capabilities`, `resources`, or `formatting` sections. Procedural content moves to workflow skills.

### Workflow — progressively disclosed lego unit

A SKILL.md with `type: workflow` in its frontmatter. Lives under `container/skills/<project>-<name>-workflow/SKILL.md`. Body loads only when invoked via `/slang-triage` etc. — native Claude Code progressive disclosure.

```markdown
---
name: slang-triage
type: workflow
description: Triage an incoming Slang issue into a subsystem + severity + next step report. Use when a new issue is assigned or user says "triage this".
uses:
  skills: [slang-github, slang-explore]
  workflows: []
params:
  issueNumber: { type: integer, required: true }
  repo: { type: string, default: "shader-slang/slang" }
produces:
  - triage_report: { path: "/workspace/group/reports/issue-{{issueNumber}}.md" }
---

# Slang Triage

1. **Ingest** — `/slang-github read issue {{issueNumber}}`. Separate facts from hypotheses.
2. **Map subsystem** — `/slang-explore subsystem-for <symptoms>`. Record candidates.
3. **Report** — write `{{triage_report.path}}`, post a concise summary upstream.
```

Properties:

- Frontmatter declares `uses.skills`, `uses.workflows`, `params`, `produces` — the lego contract.
- Composable: a workflow can `uses.workflows: [base-triage]` — the base workflow runs first, the specialized one extends.
- Reusable across projects: `base-triage`, `base-fix`, `base-review`, `base-sweep` live under `container/skills/base-*-workflow/`. Project workflows pick a base and specialize.

### Skill — progressively disclosed capability lego

`container/skills/<name>/SKILL.md` with `type: capability` (default). Unchanged from today. Frontmatter declares `allowed-tools`. Body loads on invocation.

Rule: the skill's frontmatter is the **source of truth** for tools it needs. No duplicated `allowedMcpTools` lists on coworker types.

## Coworker Type Schema

Replaces the current `CoworkerTypeEntry`:

```ts
export interface CoworkerTypeEntry {
  extends?: string | string[];
  project?: string;
  description?: string;

  identity?: string;        // path to identity fragment (.md)
  invariants?: string[];    // paths to invariant fragments
  context?: string[];       // paths to context fragments

  workflows?: string[];     // workflow skill names
  skills?: string[];        // capability skill names
}
```

Removed fields:

- `template` → split into identity/invariants/context + workflows.
- `focusFiles` → moved into context fragments.
- `allowedMcpTools` → derived from referenced skills + workflows frontmatter.

Resolution returns a flat manifest:

```ts
{
  identity: string;                              // leaf-merged
  invariants: string[];                          // append + dedup
  context: string[];                             // append + dedup
  workflows: { name; description; uses }[];      // union across chain
  skills:    { name; description; allowedTools }[];
  tools: string[];                               // derived
}
```

## CLAUDE.md Shape

```md
# <Coworker Name>

## Identity
<leaf identity fragment from type chain>

## Invariants
<append from type chain + base invariants>

## Context
<append from type chain + project overlays>

## Workflows Available
- `/slang-triage` — Triage an incoming Slang issue. Uses: slang-github, slang-explore.
- `/slang-fix` — Turn a triaged report into a fix + test + PR. Uses: slang-build, slang-explore.

## Skills Available
- `/slang-github` — GitHub issue + PR operations.
- `/slang-explore` — Code investigation + subsystem mapping.
- `/slang-build` — Build + test the Slang compiler.

_Invoke a workflow or skill with its slash command. Bodies load on demand._

## Additional Instructions
<from .instructions.md>
```

A few hundred tokens of spine + a short index. Procedural bodies stay out of context until invoked.

## Extensibility for New Projects

Zero core edits. A new project drops:

```
container/skills/
  <project>-templates/
    coworker-types.yaml                     # project types, extends base
    identity/<role>.md
    invariants/<rule>.md
    context/<area>.md
  <project>-<capability>/SKILL.md           # capability skills
  <project>-<workflow>-workflow/SKILL.md    # workflow skills (type: workflow)
```

Loader scans `container/skills/*/SKILL.md`, builds a unified catalog, and validates:

- Every `workflows:` / `skills:` name in a type resolves to a real SKILL.md.
- Every `uses.skills` / `uses.workflows` in a workflow frontmatter resolves.
- `extends` only crosses into the same project or `base-*`.
- Duplicate skill names across projects = error.

Actionable errors name the exact file.

## Migration from 6-Section Templates

One-shot script (`scripts/migrate-to-lego-templates.ts`):

1. For each `container/skills/*-templates/templates/*.yaml`:
   - `role` → `identity/<stem>.md`
   - `constraints` + hard-coded guardrails from `capabilities` → `invariants/<stem>.md`
   - `resources` + `focusFiles` → `context/<stem>.md`
   - `workflow` → `container/skills/<stem>-workflow/SKILL.md` with `type: workflow`
   - Procedural content from `capabilities` → existing capability skills or a dedicated workflow.
2. Rewrite each `coworker-types.yaml` into the new schema. Delete `allowedMcpTools` — skills' frontmatter carries them.
3. Regenerate all `groups/<folder>/CLAUDE.md` via `scripts/rebuild-claude-md.ts`. Verify every CLAUDE.md shrinks.
4. v3 `coworkers/*.yaml` exports need no schema change — `coworkerType` names are preserved.

Tests (`src/claude-composer.test.ts`) are rewritten; old tests encoded the 6-section contract and are deleted.

## Why This Is Right

- **Lego.** Each artifact (identity fragment, invariant fragment, skill, workflow) is small, independently authored and versioned. Coworkers assemble them declaratively.
- **Progressive disclosure, for real.** CLAUDE.md stays small even as the coworker gains dozens of workflows. Bodies load on demand — Claude Code's native mechanism, no reinvented runtime.
- **Simple.** Three artifact types. Four spine sections. One loader. One validator. Two merge modes (`leaf`, `append`).
- **General-purpose software development.** Base workflows cover the shape of most engineering tasks. Projects specialize; they do not rewrite.
- **Extensibility is mechanical.** Contract is filesystem + frontmatter. A new project's `SKILL.md` or workflow is discovered automatically.

## What NOT To Build

- **Workflow executor / step interpreter.** The model reads steps; no runtime.
- **Expression language for `when:` / `requires:`.** Split into two workflows. If logic is needed, the agent reads and decides.
- **State engine.** `produces:` declares path + type, not a state store. Files on disk are the state.
- **Per-step model / budget / timeout declarations.** Container-runtime concern, not template concern.
- **Parallel workflow registry.** Workflows ARE skills with `type: workflow`. Claude Code's native skill discovery handles them.
- **Deep semantic validation** (cycle detection, unreachable steps). Ship reference-resolution only; iterate.
- **Back-compat shims for old 6-section templates.** Migrate once; delete the old path. Half-migrated states are worse than a clean cut.

## Critical Files

| File | Change |
|------|--------|
| `src/claude-composer.ts` | Rewrite around spine + manifest model |
| `src/claude-composer.test.ts` | New suite for spine composition, index generation, reference resolution |
| `src/container-runner.ts` | Spine composition + derive tool allowlist from frontmatter |
| `container/skills/base-templates/` | Replaced with `base-*-workflow/` skills + `base-invariants.md` + context fragments |
| `container/skills/slang-templates/` | Identity/invariants/context fragments only; workflows move out |
| `container/skills/slang-*-workflow/SKILL.md` | New workflow skills (triage, fix, ci-babysitter, maintainer) |
| `groups/templates/manifests/coworker.yaml` | Simplified — declares fragment search paths only |
| `scripts/migrate-to-lego-templates.ts` | One-shot migration |
| `scripts/rebuild-claude-md.ts` | Re-emit CLAUDE.md under the new model |

## Verification

1. **Schema tests** — identity leaf-merge, invariants/context append-dedup, workflow/skill index, tool derivation, broken-reference errors.
2. **Migration smoke** — run migration + rebuild. Every CLAUDE.md shrinks; spine token count is bounded.
3. **Progressive disclosure e2e** — wake a coworker; no workflow body in context on first turn. Send a task; agent invokes a workflow; body loads; steps execute.
4. **Extensibility smoke** — create a throwaway project under `container/skills/demo-*` extending `base-triage`. Validator accepts; compose succeeds; agent can invoke `/demo-triage`. No TS edits.
5. **Architecture regression** — `src/slang-architecture.test.ts` + `src/architecture-alignment.test.ts` rewritten to enforce the new invariants.

## Relation to `v2-template-composition-design.md`

Supersedes. Keeps the lifecycle-pillar idea (`base-understand/plan/design/build/test/release/maintain`) as **invariant + context fragments**, not as role templates. Drops the 6-section merge model. Drops type-level `template:` references; types point at workflow and skill skills by name, and at identity/invariants/context fragments by path.
