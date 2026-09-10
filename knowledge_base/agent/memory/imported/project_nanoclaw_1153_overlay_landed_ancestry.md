---
name: project_nanoclaw_1153_overlay_landed_ancestry
description: "nanoclaw#1153 reviewed inline by Main (no nanoclaw approver exists) — 1🔴: \"prove the overlay landed\" is pure git ancestry, so a -s ours / --ours merge passes with zero overlay content; remedy verified per-path, coarse form false-passes on partial landing."
metadata: 
  node_type: memory
  type: project
  originSessionId: 1f5d55d6-313a-4f85-9533-329c8a0be3a1
---

# nanoclaw#1153 — overlay-landed check is ancestry, not content

**Reviewed at head `eab2d213`, base `nv-main` `320a9e33`.** CI 4/4 green; `ci` ran
`claude-assist.test.ts (22 tests)` (so the count is CI-confirmed, not description-sourced).
Posted [comment 5231545925](https://github.com/slang-coworkers/nanoclaw/pull/1153#issuecomment-5231545925)
via `gh api .../issues/1153/comments -X POST` — the verb-split write path
(`gh pr review`/`gh pr comment` are denied on this repo). Route: Main inline, per
[[project_nanoclaw_pr874_webhook_route_approver]] — the webhook's generic
"route to the project's `*-pr-approver`" string is overridden; no nanoclaw approver exists.

## What the PR got right (verified by execution, not by reading)

- `evaluateComposition` extracted verbatim and run: all 9 of its own cases pass, plus 3
  probes it does not write (detached with a real `branchBefore`; `built:false` + branch
  switch → `branch-switched`; residue + detached → `uncommitted-residue`). Ordering
  comment is accurate.
- `isAncestor` fail-closed claim **holds**: `git merge-base --is-ancestor` returns
  **0 / 1 / 128** — real ancestor 0, genuine non-ancestor 1, nonexistent ref 128, broken
  repo 128. `r.status === 0` maps 128 → false. "Could not verify" reads as "not verified".
- Rollback fix (return to `currentBranch` before `reset --hard`, refuse if `checkout
  --force` fails) is a genuine destructive-bug fix and under-sold in the description.

## 🔴 The finding — reachability is a graph property, not a tree property

`overlayLanded: isAncestor(projectRoot, 'origin/'+branch, head)` (`claude-assist.ts:351`).
Built real repos (overlay adds `OVERLAY_MARKER` to a shared file; nv-main edits the same
lines). All three rows pass the full 7-fact predicate:

| composed how | marker in tree | verdict |
|---|---|---|
| `git merge -s ours origin/<branch>` | **0** | SUCCESS |
| conflict resolved `--ours`, committed | **0** | SUCCESS |
| keep-both *(control)* | 1 | SUCCESS |

⭐⭐⭐**The control is what makes it a finding rather than a tautology** — the check cannot
separate the correct merge from the two broken ones. Row 2 is exactly what
`buildMergePrompt` step 2 (`:436-439`, *"keep BOTH sides' intent … Never drop one side"*)
exists to prevent, so the one mistake the prompt most fears still reports success.

**Why it bites here specifically:** the LLM tier is reached ONLY after `merge-train.sh`
already failed (`project-integrations.ts:119`), and merge-train's validation does not
carry over — `merge-train.sh:142-145` runs `install --frozen-lockfile &&
check:runtime-deps && build && rebuild:claude`; `claude-assist.ts:340` runs
`pnpm run build` **and nothing else**. `check:runtime-deps` is the one written to catch a
composition that discarded an overlay's contribution (`check-runtime-resolvable.mjs:16-30`,
the ccusage loss of #1122/#1150). `compose-check.yml:46` composes with the *deterministic*
merge-train so never sees an LLM tree; `ci.yml` is `pull_request`-only. ⇒ **third
composition path, no downstream content check.** `true` → exit 0 → `merged[]`, and
`setup/auto.ts:209-216` bakes the overlay into the container image two steps later.

## The remedy — and its measured limit

Assert content at the overlay's own paths, reusing the repo's single source of truth:
`git diff --name-only $(git merge-base origin/$branch $startHead) origin/$branch`, minus
nv-main-owned paths via `.github/nv-path-guard/ownership.py`, then
`git diff --quiet $startHead HEAD -- <path>` per path.

⛔**The owned-set exclusion is REQUIRED, not defensive** — `merge-train.sh:42-47`
deliberately resolves owned paths toward nv-main, so an allowlist-unaware check
false-fails every legitimate run. Verified `ownership.py` against the real `nv-main.txt`
(192 lines): `src/router.ts` + `setup/lib/claude-assist.ts` owned;
`container/spines/slang/x.md` + `dashboard/server.ts` not.

⭐⭐⭐**Bounded the remedy before recommending it:** built a PARTIAL landing (overlay touches
`A.ts`+`B.ts`; keep-both in A, drop B). The coarse **any-path** form **FALSE-PASSES** — A's
success masks B's loss. The **per-path** form catches it (`B.ts => FAIL`). ⇒ a remedy
proposed without its own negative case would have shipped the false-pass I was flagging.

## Two 🟡

- **Missing fetch misdiagnosed as a failed composition.** 0 hits for `fetch` in
  `claude-assist.ts` (control: 6 for `origin/`). `merge-train.sh:29` fetches, but `set -euo
  pipefail` (`:18`) means a *failed* fetch exits non-zero — the exact condition that hands
  off to the LLM tier. Constructed with `--single-branch`: status 128 → `overlayLanded:
  false` → *"whatever was committed, it was not this overlay."* Fail-closed is right; the
  message accuses the assistant and sends someone to re-merge instead of fetch.
- **Rollback error path can throw from inside its own message.** `:397-402` interpolates
  `rev(...)`, and `rev` is `execSync` (`:317-318`) which throws on non-zero — confirmed by
  execution. 0 hits for `catch` in either file. In the one state the branch exists for, the
  operator loses the `startHead` line.

## Corrected figure

Description says "22 tests pass (9 new)". Base `11` → head `22` ⇒ **11 new** (9
`evaluateComposition` + 2 `isAncestor`). The two undercounted ones are precisely those
proving the fail-closed claim.

Blast radius genuinely narrow: `NANOCLAW_LLM_MERGE` → 5 hits all in `setup/`, one read
(`project-integrations.ts:217`); **0 in `.github/`** (control: `MERGE_TRAIN_NO_INSTALL`/
`GH_TOKEN` → 8 hits there, so the grep works). Nothing sets it. ⇒ graded as a correctness
gap in the claim, not a production incident.

Related: [[project_nanoclaw_1150_ccusage_own_nvmain]] (its 🔴 was the same shape — guard
present on the loud path, absent from the silent one), [[project_nanoclaw_1113_merge_assist_residue]],
[[project_nanoclaw_1120_owned_drift_verifier]].
