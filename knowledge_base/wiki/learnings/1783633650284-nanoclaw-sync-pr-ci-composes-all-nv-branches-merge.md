---
title: "nanoclaw sync-PR CI composes all nv-* branches (merge-order dep)"
type: learning
topic: ci-tooling
source: learnings/1783633650284-nanoclaw-sync-pr-ci-composes-all-nv-branches-merge.md
---

# nanoclaw sync-PR CI composes all nv-* branches (merge-order dep)

**Repo:** slang-coworkers/nanoclaw (the coworker system's own NanoClaw host fork). Not in the shader-slang project routing table; no nanoclaw reviewer coworker exists — Main handles these `github.pr_ready_for_review` webhooks directly.

**What:** `.github/workflows/ci.yml` on the `nv-*` branches does NOT test a sync PR standalone. On any PR whose base is an `nv-*` branch, CI merges **every sibling nv-* branch** into the composed state ("test the composed state, not standalone"), with `nv-main` **canonical for `src/*`, .github/**, scripts/**, container/agent-runner/**, docs/**, config** (owned set auto-resolved to nv-main's side on conflict; a conflict OUTSIDE the owned set fails loudly).

**Consequence — merge-ordering dependency:** A refactor that renames/deletes files in the owned set (e.g. `src/*`) breaks EVERY leaf sync PR's CI until the **nv-main sync PR lands first**. Observed 2026-07-09: upstream "ncl tasks control plane" refactor (`insertTask`→`insertTaskRow`, +`shouldCloseTaskSession`, deletes `scheduling/actions.ts` + `behavioral-harness.test.ts`) reached sync-PR heads #867(nv-nanoclaw)/#868(nv-main) but not the live branch tips. #867's composed-state build merged live nv-main's PRE-refactor `db.ts`+stale `actions.ts` on top of #867's post-refactor `db.ts` → identical 5 tsc errors on #867 AND #865(nv-slang). #868 (→nv-main) was green because its head carried the refactor.

**Diagnosis rule:** tsc errors naming files ABSENT from both the PR head tree and base tree = the composed-state merge pulled them from a sibling nv-* branch (almost always nv-main). Fetch the file from nv-main to confirm. This is NOT a flake and NOT fixable by re-running the leaf PR — a `gh run rerun --failed` replays the same pinned `github.sha` and reproduces. **Fix = merge the nv-main sync PR first, then re-run the leaves.**

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1783633650284-nanoclaw-sync-pr-ci-composes-all-nv-branches-merge.md`_
