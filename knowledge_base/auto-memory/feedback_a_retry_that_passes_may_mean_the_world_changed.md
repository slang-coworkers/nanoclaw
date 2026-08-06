---
name: feedback_a_retry_that_passes_may_mean_the_world_changed
description: "A CI re-run that goes green on an IDENTICAL head is not evidence of a flake — an external ref (a sibling branch) may have advanced between attempts. Only the two attempts' logs discriminate; check-runs shows the latest attempt only."
metadata:
  node_type: memory
  type: feedback
  originSessionId: ef48af88-c2c2-4cc9-afd9-cd458bdd2695
---

**A re-run that passes on the same head SHA has two possible causes, and the API surface cannot
tell them apart: (a) a genuinely transient failure, or (b) the WORLD changed between attempts —
an external ref the build reads advanced.** Treating (b) as (a) files a real ordering defect as
"flake" and discards the reason it will recur.

**Measured instance — `slang-coworkers/nanoclaw#1090`, 2026-08-05** (a `sync-upstream.sh` fan-out
PR, `sync/upstream-nv-slangpy` → `nv-slangpy`, head `e612f89f`):

- Attempt 1 (14:24Z) **FAILED**: `Container tests` → `SyntaxError: Export named 'TOOL_ALLOWLIST'
  not found in module '…/providers/claude.ts'`, 346 pass / 1 fail.
- Attempt 2 (14:28Z) **PASSED**, 17/17 steps, **same head SHA, no new commit.**

The discriminating fact was **not** in `check-runs`, `pulls/N`, or `runs/{id}/jobs` — all of which
report only the latest attempt. It was in the two attempts' *merge-step logs*:

- `ci.yml` builds a **composed state**: it merges every sibling `nv-*` branch and auto-resolves any
  conflict inside nv-main's owned set (which includes `container/agent-runner/*`) by
  `git checkout origin/nv-main -- <file>`.
- Attempt 1: `claude.ts` **conflicted** and was resolved to `origin/nv-main`, which at 14:24Z was
  still `c0bc5a03` — bare `const`, no `export`. The PR's new test file survived the merge while the
  module it imports from got replaced by a version lacking the export ⇒ `SyntaxError`, *not* a
  failing assertion.
- Attempt 2: sibling PR **#1086 merged into `nv-main` at 14:27:43Z**, carrying the same upstream
  commit. `claude.ts` no longer appears in attempt 2's conflict list at all ⇒ green.

**Why this is structural, not incidental:** `sync-upstream.sh` opens one PR per overlay branch from
the same upstream commit. Any leaf PR whose diff touches an nv-main-**owned** path is red until the
`nv-main` PR merges. Nothing enforces the order — #1090's own body said *"Composes against the
freshly-synced nv-main (PR #1086, merged first)"*, yet #1086 merged **3m42s after** #1090's first CI
run started.

**How to apply:**

1. When a re-run flips red→green on an unchanged head, **do not label it a flake** until you have
   compared the attempts. Fetch per-attempt logs — the only surface that retains them:
   ```
   gh api repos/{o}/{r}/actions/runs/{id}/attempts/{1,2}/logs > a.zip && unzip -q a.zip
   ```
   `runs/{id}/attempts/{n}/jobs` gives per-attempt step conclusions; plain `runs/{id}/jobs` and
   `commits/{sha}/check-runs` do not (see [[feedback_a_phantom_correction_deletes_true_evidence]],
   [[feedback_filter_latest_returns_two_suites_per_sha]]).
2. **Ask what external refs the build reads.** A workflow that fetches other branches, pulls a
   registry tag, resolves a floating dep, or reads a sibling repo has a mutable input that is not
   the head SHA. "Same SHA" bounds *your* diff, never the build's whole input set — cf.
   [[feedback_every_copy_on_my_disk_never_settles_what_a_run_did]].
3. **The error's SHAPE is the tell.** A `SyntaxError: Export named X not found` (module-load
   failure) is not a test-logic failure; it means the tree under test was inconsistent, which
   points at composition, not at the code under review.

⚠️**EVIDENCE BASE: ONE case** (#1090). The mechanism is structural and readable in the workflow, so
the *check* is worth running; hold the frequency claim loosely and re-derive when it next fires,
per this store's single-case rule. Related class record and the ~21 prior instances of the
inline-routing rule for this repo: [[project_nanoclaw_pr874_webhook_route_approver]].
