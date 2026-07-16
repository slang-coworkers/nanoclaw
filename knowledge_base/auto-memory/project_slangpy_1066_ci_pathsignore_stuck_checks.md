---
name: project_slangpy_1066_ci_pathsignore_stuck_checks
description: "slangpy#1066 CI paths-ignore + required matrix checks → wheels/docs-only PRs stuck pending; maintainer-gated design pick A/B/C"
metadata: 
  node_type: memory
  type: project
  originSessionId: a7d77ab1-066a-4e5d-ba06-9bf443fee457
---

**slangpy#1066** (jhelferty-nv, 2026-07-15) — CI-infra bug, P1. `ci.yml` trigger-level `paths-ignore` (LICENSE, `**.md`, wheels.yml, ci-gcp.yml, ci-latest-slang.yml) means ignored-only PRs never run `ci`, but branch protection still requires 12 `build(...)` matrix contexts → stuck "Expected — Waiting for status" forever. Load-bearing distinction: `paths-ignore`-skipped workflow never reports (stuck); `if:`-skipped job reports "skipped" = passing.

Live block: **PR #1002** (Py 3.14 wheels) — currently also edits pyproject.toml so matrix IN_PROGRESS (workaround). Downstream: **#950** (pip Py3.14 → v0.23.0 fallback).

Three approaches (triage memo `triage-1066.md`): **C** (issue Option B — delete both `paths-ignore` blocks, ~13 lines; RECOMMENDED, has documented maintainer decision behind it); **A** (revive #847 filter+`if:`-gate, keep 12 names); **B** (issue Option A — full slang-align: filter + aggregate `ci` gate + branch-protection swap to require `ci`+`license/cla`).

**HARD CONSTRAINTS:** (1) bot cannot push `.github/workflows/**` (no `workflows` perm; cross-fork PR policy-closed) — maintainer must apply YAML. (2) branch-protection edits are admin-only. (3) A/B/C is maintainer-gated: **#847 closed 2026-03-12 by jkiviluoto-nv** "remove the filtering altogether as discussed offline" (favors C); reporter jhelferty-nv lists Option A first (may favor keeping CI-cost savings).

**State (2026-07-15, HELD terminal):** triaged → design verified against `origin/main` by slangpy-fixer → ready-to-apply patch drafted (Approach C). No draft PR (none will open — bot can't push `.github/workflows/**`; deliverable is a diff/patch artifact for a maintainer). GitHub footprint = issue comment updated in place (comment 4985640503). Chain: orchestrator → slangpy-triager → slangpy-fixer (triager owns fixer wire; no double-dispatch from Main). Canonical thread `gh-issue-shader-slang/slangpy-1066`.

**Fixer refinements (verified against current main):**
- **R1:** Approach A can NOT verbatim-revive #847 — stale runner labels (`group: nvrgfx` vs current `nvrgfx-kernelvm-bridge`); must graft the ~40-line filter job onto current main's matrix.
- **R2:** aggregate-gate idiom already exists internally at `ci-latest-slang.yml:113-147` → Approach B is a small in-repo step, not a foreign slang import.
- **R3:** the "12 required contexts" count is a symptom-grounded hypothesis (bot 404s on the protection API); only matters for Approach B's branch-protection swap.

**Resumption trigger:** maintainer (jkiviluoto-nv / jhelferty-nv) picks A/B/C on #1066 → webhook reopens chain → fixer prepares exact diff → maintainer lands YAML (+ admin branch-protection swap if A/B). Recommended default C (~15-line `paths-ignore` deletion, matches #847 offline "remove filtering altogether" decision). Triager will surface the diff-ready artifact on this thread on resume.
