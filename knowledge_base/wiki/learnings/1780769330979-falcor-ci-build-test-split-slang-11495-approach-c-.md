---
title: "Falcor CI build/test split (slang#11495): Approach C over windows-latest — CUDA is the blocker, LLVM-from-GCS is a public bucket"
type: learning
topic: ci-tooling
source: learnings/1780769330979-falcor-ci-build-test-split-slang-11495-approach-c-.md
---

# Falcor CI build/test split (slang#11495): Approach C over windows-latest — CUDA is the blocker, LLVM-from-GCS is a public bucket

## Context
shader-slang/slang#11495 — split `.github/workflows/falcor-test.yml` so the Slang build moves off the Falcor self-hosted GPU runner (preinstalled Falcor at `C:\Falcor\*`) which was a CI-turnaround bottleneck. Issue author preferred a free `windows-latest` build runner (triage's Approach A). Shipped **Approach C** instead: split into two jobs in the same file, build on `[Windows, self-hosted, build]` (the standard Slang build pool), test on `[Windows, self-hosted, falcor]` with `needs: build`, artifact handed over via `actions/upload-artifact@v4` → `download-artifact@v4` (name `slang-falcor-build-windows-release`).

## Why Approach C over the author-preferred windows-latest (Approach A)
The Falcor build flag set (`SLANG_ENABLE_CUDA=1`, `USE_SYSTEM_LLVM`, GFX=0, RHI=0, TESTS=0, EXAMPLES=0, DAWN/TINT excluded) must be preserved verbatim. Against that flag set, `windows-latest` has one hard blocker + two soft ones:

1. **HARD: CUDA toolkit absent on `windows-latest`.** Falcor's build sets `SLANG_ENABLE_CUDA=1`; the GitHub-hosted image ships no CUDA toolkit/`nvcc`, so configure fails. Working around it means either dropping the CUDA flag (changes Falcor's build surface — out of scope) or installing CUDA in-job (~5 min + brittle external action). This alone forces C for the first cut.
2. **SOFT: sccache cache lives on self-hosted infra** (`ci-slang-build.yml:73-79` restores `C:/sccache`). Free runner starts cold → slow first build until an `actions/cache` story is wired.
3. **CORRECTION to a tempting false premise: LLVM-from-GCS does NOT need GCP auth for downloads.** `actions/setup-llvm-from-gcs/action.yml` pulls the prebuilt LLVM via plain `curl` from a **publicly-readable** bucket (`storage.googleapis.com/slang-ci-cache/llvm-prebuilts/...`). The `google-github-actions/auth@v2` step in `ci-slang-build.yml:82-87` is needed only for LLVM **upload** on `refs/heads/master`, NOT for PR-run downloads. So "free runners can't fetch LLVM" is wrong — they can. (A draft plan asserted this was an A-blocker; it isn't.) The real A-blocker is CUDA (#1), not LLVM.

Approach A (windows-latest) remains the desirable long-term endpoint; deferred to a focused follow-up that owns the CUDA-toolkit + sccache-cache decisions.

## Mechanics that worked
- Removed the single-entry `strategy.matrix` (it had exactly one include row) and inlined the literal values — cleaner than carrying a 1-row matrix.
- `if: github.event.pull_request.draft != true` lives on the `build` job (chain entry); `test` inherits the skip via `needs: build`. No need to repeat it.
- Workflow-level `paths-ignore` + `concurrency` gate BOTH jobs — no per-job filter logic needed.
- Known constraint (documented in PR, not fixed): `actions/download-artifact@v4` is attempt-scoped, so `gh run rerun --failed` on a test-only failure errors "Artifact not found" — needs a full rerun. Same for every split workflow in the repo (`materialx-test.yml`, `ci-slang-test.yml`).

## Push path (workflow-perm)
Touches only `.github/workflows/*` → `nv-slang-bot` App lacks `workflows` permission → bot push is rejected atomically. Per consolidated learning 1780558703303: produced `git format-patch master..HEAD`, `send_file` to orchestrator with target branch + base sha + full PR body; orchestrator's PAT applies (`git am`) + pushes + opens the draft PR. The PR (carrying `Fixes #11495`, 5-bullet body) is the durable GitHub artifact for this chain — the bot can't materialize it directly.

## Out-of-scope sibling
`.github/workflows/falcor-compiler-perf-test.yml` has the identical monolithic build+run pattern on `[Windows, self-hosted, perf]`. Same split applies; flagged for a separate ticket (issue #11495 scoped to Falcor *tests* only).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1780769330979-falcor-ci-build-test-split-slang-11495-approach-c-.md`_
