# Lego Coworker Workflows

Typed coworkers are composed at build time from five artifacts: **spine fragments**, **skills**, **workflows**, **overlays**, and **traits + bindings**. The composer renders a thin always-in-context `CLAUDE.md` (the "spine") and leaves procedural bodies on disk, loaded on demand via slash commands.

Implementation: `src/claude-composer.ts`. Tests: `src/claude-composer.test.ts`. Runtime consumer: `src/container-runner.ts`.

## Why

Monolithic role templates burned context on procedural detail that was only relevant when a specific task ran. The previous fixed 6-section model (`role / capabilities / workflow / constraints / formatting / resources`) conflated always-in-context identity with on-demand procedure, and project-specific workflows forced you to fork base workflow bodies whenever a trait (e.g. which GitHub skill to use) needed swapping.

The lego model fixes both:

- **Spine + progressive disclosure** — CLAUDE.md stays small. Workflow and skill bodies live in `container/skills/<name>/SKILL.md` and load when the agent invokes the slash command.
- **Traits + bindings** — base workflows declare what they *need* (`requires: [vcs-pr, code-edit]`); coworker types declare what they *use* (`bindings: { vcs-pr: slang-github }`). The same `base-fix` workflow runs unchanged on Slang, on a Perforce project, or on a Jujutsu project.
- **Overlays** — orthogonal concerns (critique, telemetry, approval gating) plug into any matching workflow without editing its body.

## Glossary

| Term | What it is |
|---|---|
| **coworker type** | Named persona. Lives in `container/skills/*/coworker-types.yaml`. Composes spine fragments + skills + workflows + overlays + bindings. |
| **spine** | The always-in-context `CLAUDE.md`. Sections: identity, invariants, context, index, bindings, customizations. |
| **identity / invariants / context** | Spine fragments — markdown files referenced by path. Merge modes: identity = **leaf wins**; invariants + context = **append + dedup**. |
| **skill** | `SKILL.md` without `type:` (or `type: capability`). Body loads on `/skill-name`. Declares `allowed-tools`; optionally `provides: [trait, …]`. |
| **workflow** | `SKILL.md` with `type: workflow`. Body loads on `/workflow-name`. Declares `requires: [trait, …]`, `uses`, optional `extends` + per-step `overrides`. |
| **overlay** | `SKILL.md` with `type: overlay`. Compose-time augmentation. Declares `applies-to.{workflows, traits}` + `insert-before` / `insert-after` step anchors. Attached to a coworker type, not a workflow. |
| **trait** | An abstract dash-case capability name. Skills `provide`; workflows `require`; types `bind`. |
| **provides** | Skill frontmatter list of traits this concrete skill fulfills. |
| **requires** | Workflow frontmatter list of traits this workflow needs. |
| **bindings** | Coworker-type map from trait → concrete skill name. Leaf wins across the extends chain. |
| **step** | A numbered instruction inside a workflow body, optionally anchored with `{#step-id}`. Overlays splice relative to a step ID; `overrides` replace bodies by step ID. |
| **extends** (on workflow) | Workflow inheritance — the derived workflow renders as the parent's body with `overrides` applied. |
| **extends** (on type) | Type inheritance — ancestors contribute identity/invariants/context/skills/workflows/overlays/bindings with leaf-wins identity + leaf-wins bindings and append+dedup for the rest. |

Naming rules:

- Lowercase dash-case for every artifact, trait, and step ID.
- Base workflows: `base-*`. Project skills and types: `<project>-*`. Universal skills skip the project prefix (`deep-research`, `codex-critique`).
- Overlay names end in `-overlay`.
- Trait names follow `<domain>-<verb>`: `vcs-pr`, `code-edit`, `ci-inspect`. No nouny traits like `"github"` — that's a project, not a capability.

## Canonical trait vocabulary

Extend as new projects need them. A skill can provide multiple traits.

| Trait | Intent |
|---|---|
| `vcs-read` | Read repo state: status, diff, log, branches. |
| `vcs-write` | Commit, push, create branches. |
| `vcs-pr` | Open, update, comment on pull/merge requests. |
| `issue-tracker` | Read/update issues. |
| `ci-inspect` | Read CI status + logs. |
| `ci-rerun` | Trigger CI reruns. |
| `code-read` | Grep/Glob/Read source. |
| `code-edit` | Patch + commit a code change. |
| `code-build` | Build/compile the project. |
| `test-run` | Execute the existing test suite. |
| `test-gen` | Author new tests. |
| `doc-read` | Read project docs. |
| `doc-write` | Author/update docs. |
| `research` | External deep-research (deepwiki, web). |
| `critique` | Quality-assess an artifact and score/flag it. |

---

## The five artifacts — with concrete examples

### 1. Spine fragment

Plain markdown. Composed by path reference from a coworker type.

`container/skills/base-spine/invariants/safety.md`:

```md
- Never silence a failing test to make a task "done".
- Never force-push, rebase published branches, or skip hooks without explicit authorization.
- Treat /workspace/project as read-only. All writes go under /workspace/group/.
```

`container/skills/slang-spine/identity/compiler.md`:

```md
You are a specialist on the Slang shading-language compiler (shader-slang/slang).
You know its subsystems, its public-API invariants, and its build + test layout.
```

### 2. Skill (capability)

`container/skills/slang-github/SKILL.md`:

```yaml
---
name: slang-github
description: Interact with GitHub for shader-slang/slang. Fetches issues/PRs, reviews diffs, creates PRs.
provides: [vcs-read, vcs-write, vcs-pr, issue-tracker, ci-rerun]
allowed-tools: Bash(git:*), Bash(gh:*), Read, Grep, Glob, mcp__slang-mcp__github_get_issue, mcp__slang-mcp__github_get_pull_request
---

# Slang GitHub
<body — loads on `/slang-github`>
```

Key points:

- `provides:` lists every trait this skill fills. One skill can cover several trait slots.
- `allowed-tools:` is the source of truth for the MCP tool allowlist derivation. Non-MCP tokens (e.g. `Bash`, `Read`) are ignored by `extractAllowedTools`.
- A skill **without** `provides:` is still invokable directly but can't fill a trait slot.

### 3. Workflow (base)

`container/skills/base-fix-workflow/SKILL.md`:

```yaml
---
name: base-fix
type: workflow
description: Take a triaged issue from reproduction through minimal patch, tests, and PR-ready state.
requires: [code-read, code-edit, test-run, vcs-pr]
uses:
  skills: []
  workflows: [base-triage]
---

# Base Fix

## Steps

1. **Load context** {#load-context} — read the triage report for `{{target}}` …
2. **Reproduce** {#reproduce} — create a minimal repro …
3. **Root-cause** {#root-cause} — evidence: file + line + mechanism …
4. **Patch** {#patch} — implement the minimum change …
5. **Validate** {#validate} — run the project test suite + format/lint/typecheck …
6. **Commit + prepare PR** {#commit} — descriptive commit message …
```

Step IDs (`{#load-context}`, `{#patch}`, …) are the seams. Anchor only the steps a derived workflow or overlay might target.

### 4. Workflow (derived — extends + overrides)

`container/skills/slang-fix-workflow/SKILL.md`:

```yaml
---
name: slang-fix
type: workflow
description: Slang specialization of /base-fix — build, test, PR conventions.
extends: base-fix
requires: [code-read, code-edit, test-run, vcs-pr]
overrides:
  reproduce: "Extract the failing case into tests/bugs/issue-{{issueNumber}}.slang. Commit the failing test first so CI can show the delta."
  patch:     "Use /slang-patch to implement the minimum change. Keep the patch inside one subsystem."
  validate:  "Rebuild with /slang-build, run ./build/Debug/bin/slang-test tests/bugs/issue-{{issueNumber}}.slang and ./extras/formatting.sh."
uses:
  skills: [slang-build, slang-explore, slang-github, slang-patch]
  workflows: [base-fix]
---
```

The composer renders an `extends` customization line in the spine; on invocation Claude reads the parent body and applies the per-step `overrides` bodies.

### 5. Overlay

`container/skills/critique-overlay/SKILL.md`:

```yaml
---
name: critique-overlay
type: overlay
description: Insert an external critique step after a workflow's patch / generate / draft step.
applies-to:
  workflows: [base-fix, base-test-gen, base-docs]
  traits: [code-edit, test-gen, doc-write]
insert-after: [patch, generate, draft]
uses:
  skills: [codex-critique]
---

**Critique** {#critique} — before committing, invoke `/codex-critique` against the working diff.
- If the critique returns `must-fix` items, do not commit. Loop back.
- If `should-fix` items are declined, justify each one in the workflow log.
```

The overlay attaches to a **coworker type** (not a workflow). At compose time the composer intersects `applies-to.{workflows, traits}` with the workflows this coworker actually references; unused overlays are silently skipped.

### 6. Coworker type

`container/skills/base-spine/coworker-types.yaml`:

```yaml
base-common:
  description: "Universal coworker spine — safety, truthfulness, scope, workspace conventions."
  invariants:
    - container/skills/base-spine/invariants/safety.md
    - container/skills/base-spine/invariants/truthfulness.md
    - container/skills/base-spine/invariants/scope.md
  context:
    - container/skills/base-spine/context/workspace.md
    - container/skills/base-spine/context/invocation.md
  skills:
    - base-nanoclaw
    - deep-research
  workflows:
    - base-triage
    - base-review
    - base-sweep
    - base-ci-health
    - base-research
```

`container/skills/slang-spine/coworker-types.yaml`:

```yaml
slang-common:
  description: "Slang compiler spine — every Slang coworker extends this."
  project: slang
  extends: base-common
  identity: container/skills/slang-spine/identity/compiler.md
  invariants: [container/skills/slang-spine/invariants/public-api.md]
  context:    [container/skills/slang-spine/context/layout.md]
  skills:     [slang-build, slang-explore, slang-github]
  workflows:  [base-pr-update]
  bindings:
    vcs-read: slang-github
    vcs-write: slang-github
    vcs-pr: slang-github
    issue-tracker: slang-github
    code-read: slang-explore
    code-build: slang-build
    test-run: slang-build
    ci-inspect: slang-build
    ci-rerun: slang-github

slang-fix:
  description: "Turn triaged Slang reports into minimal fixes with tests."
  project: slang
  extends: slang-common
  skills: [slang-patch, codex-critique]
  workflows: [slang-fix, base-fix, base-test-gen]
  overlays: [critique-overlay]
  bindings:
    code-edit: slang-patch
    test-gen:  slang-patch
    critique:  codex-critique
```

---

## Resolution pipeline

`resolveCoworkerManifest(types, typeName, catalog, projectRoot)`:

1. **Walk the type chain.** `resolveTypeChain` does a DFS through `extends`, guarding against cycles. Chain order: ancestors → descendants.
2. **Accumulate fragments.** Identity is leaf-wins. Invariants + context are appended and deduped by resolved absolute path.
3. **Union skills, workflows, overlays.** Leaf-wins bindings merge across the chain.
4. **Validate references.** Every `skill`/`workflow`/`overlay` name must exist in the catalog; throws with an actionable message naming the offender.
5. **Validate traits.** For every `requires:` on every referenced workflow: either a skill in the set directly `provides:` the trait, or `bindings:` must map it to a skill that `provides:` it. Errors call out the exact missing trait or mis-mapped skill.
6. **Collect customizations.** Per-workflow: `extends` lines, each `overrides` step, and every overlay that targets the workflow (by name or via a matching `applies-to.traits` entry).
7. **Derive tools.** Union `allowedTools` from every referenced skill + transitive workflow `uses` + bound trait skills + overlay skills. Filter to `mcp__*` at the consumer (`container-runner.ts`).

Cross-project guardrails: `extends` across projects throws; `+` composition (e.g. `slang-fix+dashboard`) across projects warns but does not throw.

## What the composed CLAUDE.md looks like — `slang-fix`

```md
# Slang Fix

## Identity
You are a specialist on the Slang shading-language compiler (shader-slang/slang).
You know its subsystems, its public-API invariants, and its build + test layout.

## Invariants
- Never silence a failing test to make a task "done".
- Never force-push, rebase published branches, or skip hooks without explicit authorization.
- Treat /workspace/project as read-only. All writes go under /workspace/group/.
- include/slang.h and *.meta.slang are stable public surface …

## Context
- Workspace layout: /workspace/{group, project, global} …
- Invocation protocol: respond in-channel; summarize; link artifacts …
- Slang repo lives at /workspace/group/slang …

## Workflows Available
- `/slang-fix` — Slang specialization of /base-fix. Requires traits: code-read, code-edit, test-run, vcs-pr.
- `/base-fix` — Take a triaged issue through reproduction → patch → PR. Requires traits: code-read, code-edit, test-run, vcs-pr.
- `/base-test-gen` — Author tests from a spec or bug. Requires traits: code-read, test-gen, vcs-pr.
- `/base-triage`, `/base-review`, `/base-sweep`, `/base-ci-health`, `/base-research`, `/base-pr-update` — …

## Skills Available
- `/base-nanoclaw` — Host tools. Provides: messaging, scheduling, elicitation, learning.
- `/slang-github` — Provides: vcs-read, vcs-write, vcs-pr, issue-tracker, ci-rerun.
- `/slang-build` — Provides: code-build, test-run, ci-inspect.
- `/slang-explore` — Provides: code-read, doc-read.
- `/slang-patch` — Provides: code-edit, test-gen.
- `/codex-critique` — Provides: critique.
- `/deep-research` — Provides: research.

## Trait Bindings
- `ci-inspect` → `/slang-build`
- `ci-rerun` → `/slang-github`
- `code-build` → `/slang-build`
- `code-edit` → `/slang-patch`
- `code-read` → `/slang-explore`
- `critique` → `/codex-critique`
- `doc-read` → `/slang-explore`
- `issue-tracker` → `/slang-github`
- `test-gen` → `/slang-patch`
- `test-run` → `/slang-build`
- `vcs-pr` → `/slang-github`
- `vcs-read` → `/slang-github`
- `vcs-write` → `/slang-github`

## Workflow Customizations
- `/slang-fix` extends `/base-fix` — run base steps, then the specialized steps.

- In `/slang-fix`, step `reproduce` is overridden.

  Extract the failing case into tests/bugs/issue-{{issueNumber}}.slang. Commit the failing test first …

- In `/slang-fix`, step `patch` is overridden.

  Use /slang-patch to implement the minimum change. Keep the patch inside one subsystem.

- `/base-fix` is augmented by `critique-overlay` after step `patch`.

  **Critique** — before committing, invoke `/codex-critique` against the working diff. …

_Invoke a workflow or skill with its slash command. Bodies load on demand._
```

Procedural bodies (the actual Steps sections of `/base-fix`, `/slang-fix`, etc.) are **not** in this document — they load when the agent invokes the slash command. The spine surfaces only the shape.

## Extending the system

**Add a new base workflow.** Author `container/skills/base-<name>-workflow/SKILL.md` with `type: workflow`, a `requires:` list, and a body with anchored step IDs. Reference it from `base-common.workflows` (or any type that should expose it). Every coworker whose bindings cover the `requires:` gets it automatically — no TS change.

**Add a new overlay.** Author `container/skills/<name>-overlay/SKILL.md` with `type: overlay`, `applies-to`, `insert-after` / `insert-before`, and a step body. Attach it to a coworker type via `overlays: [<name>-overlay]`. Bind any trait the overlay needs.

**Port a base workflow to a new project.** Declare project skills that `provide:` the required traits. Create a `<project>-common` type that `extends: base-common` and sets `bindings:` for every trait. Leaf types inherit bindings automatically.

**Specialize a base workflow.** Author a `<project>-<name>-workflow/SKILL.md` with `extends: base-<name>` and per-step `overrides:`. No body needed — the composer splices. Reference the derived workflow from the leaf type.

## Validator errors

Every validation path throws with a message naming the exact offender. Examples:

- `Coworker type "slang-fix" references unknown skill/workflow: frobnicator.` — fix the `skills:` / `workflows:` / `overlays:` list.
- `Coworker type "slang-fix" requires trait(s) with no binding: telemetry.` — add a skill that `provides: [telemetry]`, or bind it explicitly.
- `Coworker type "slang-fix" binds trait "code-edit" → "runner-skill", but "runner-skill" does not declare provides: [code-edit].` — fix the mapping or annotate the skill's `provides:`.
- `Duplicate coworker type "slang-fix" found in <path>.` — two `coworker-types.yaml` files declared the same key.
- `Cross-project extends: "slang-fix" (project: slang) cannot extend "graphics-common" (project: graphics).` — use `+` composition at the type-name level instead.

## Non-goals

- **No runtime.** All lego machinery is compose-time → static files. The agent reads the workflow body via native progressive disclosure and consults the spine for bindings + customizations.
- **No expression language.** No `when:`, `unless:`, `requires: (x or y)`. Two workflows or two overlays is the answer.
- **No trait inference.** `provides:` is explicit.
- **No overlay chaining.** Overlays apply in declared order on the coworker type. Merge concerns into one overlay if they depend on each other.
- **No per-group materialized workflow files.** Customizations are rendered into CLAUDE.md; the original workflow body stays shared.

## File map

| File | Role |
|---|---|
| `src/claude-composer.ts` | `parseSkillMeta` · `readCoworkerTypes` · `readSkillCatalog` · `resolveTypeChain` · `resolveCoworkerManifest` · `composeCoworkerSpine` · `composeClaudeMd` |
| `src/claude-composer.test.ts` | Unit coverage for the above. |
| `src/container-runner.ts` | `resolveAllowedMcpTools` consumes `manifest.tools`; `composeCoworkerClaudeMd` renders the spine on every container wake. |
| `container/skills/<name>/SKILL.md` | Skill / workflow / overlay bodies + frontmatter. |
| `container/skills/*/coworker-types.yaml` | Distributed type registry. Each spine (base, slang, …) ships its own. |
| `container/skills/*-spine/identity/*.md` | Identity fragments. |
| `container/skills/*-spine/invariants/*.md` | Invariant fragments. |
| `container/skills/*-spine/context/*.md` | Context fragments. |
| `docs/lego-coworker-workflows.md` | This document. |

## Verification checklist

1. **Trait substitution.** A workflow body containing `/{{trait:vcs-pr}}` composes with the binding. CLAUDE.md carries the bindings table.
2. **Overrides.** A derived workflow with `extends: base-fix` + `overrides: { patch: "…" }` composes a Workflow Customizations block naming step `patch` with the override body.
3. **Overlay application.** An overlay with `applies-to.workflows: [base-fix]` + `insert-after: [patch]` produces a customization line: `/base-fix is augmented by <overlay> after step \`patch\`.`
4. **Validator errors.** Unbound trait, wrong provider, unknown skill/workflow/overlay, cross-project extends — each raises an actionable error naming the offender.
5. **Progressive disclosure.** Workflow bodies stay in `container/skills/<name>/SKILL.md`; the spine grows only by the bindings table and customizations for referenced workflows.
6. **Cross-project reuse.** A new project extending `base-common` + binding traits to its own skills composes cleanly with zero TS edits.
