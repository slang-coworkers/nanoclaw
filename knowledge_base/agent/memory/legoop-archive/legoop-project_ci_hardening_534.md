---
type: project
title: "PR"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

> **[dev-context]** Ported from the dev (lego) instance; this is historical/dev-vault detail. For current prod facts see the prod-accurate learnings (no szihs PAT; vault :10254; nanoclaw.service; groups on real disk).

# PR

PR #534 (merged 2026-06-02) fixed nv-main CI, which had been red for weeks while *masking* real failures. Composed CI-equivalent tree (nv-main + leaves + fetch-skills) now: **873 passed, 0 failed, 74 files**.

## Two root causes fixed

1. **Merge step silently dropped branches.** `.github/workflows/ci.yml` "Merge nv-* branches" used `git merge 2>/dev/null || { warning; merge --abort }`. Every nv-* leaf trivially conflicts on nv-main-owned infra (`package.json` version bumps; and `ci.yml` itself whenever the workflow is edited), so CI aborted the *entire* leaf merge → dropped that branch's content (e.g. base-nanoclaw) → `validate:templates` failed downstream with a misleading "unknown skill" error.
   - **Fix:** on conflict, classify paths. Owned set = `package.json package-lock.json pnpm-lock.yaml .github/**` → auto-resolve to integration side (`git checkout --ours`). Anything outside that set → `exit 1` with the file list. Plain `git merge` (NOT `-X ours`) so real overlay content conflicts still surface. `set -e`.
   - Verified with a dry-run harness across all 5 PR bases + an injected non-owned conflict (fails loudly).

2. **webhook-github.test.ts broken since #513.** #513 added an idempotency guard `db.prepare('SELECT 1 FROM messages_in WHERE id=?').get(rowId)` to delivery paths, but the 10 `openInboundDb` mocks returned only `{ close }` — no `.prepare`. All 5 delivery tests threw `db.prepare is not a function` (or fell through to `'no-admin-group'`). Masked because CI never reached the test step. **Fix:** each mock now returns `prepare: () => ({ get: () => undefined, run: () => undefined })`.

## Key lesson: standalone vs composed

nv-main does NOT compose standalone — `default`/`base-common` reference `base-nanoclaw` (lives on nv-nanoclaw) and `slang-*` types reference registry skills (`shader-slang/slang-skills@main`, pulled by `scripts/fetch-skills.sh`). **CI tests the COMPOSED tree** (merges leaves + runs fetch-skills), so:
- Local `npm test` on a standalone nv-main branch shows spurious `default`/base-nanoclaw + slang-* failures. NOT real.
- To reproduce CI locally: merge the 4 sibling leaves (auto-resolving owned infra), `pnpm run build`, `bash scripts/fetch-skills.sh`, THEN `npm test`.

Pushed via the szihs-fork workflow-scope bypass — see [[reference_workflow_push_via_szihs_fork]].

Related: [[project_fanmerge_is_local_only]], [[project_composer_zero_warnings]] (R18 also needs fetch-skills to pass), [[project_skill_registry]].

