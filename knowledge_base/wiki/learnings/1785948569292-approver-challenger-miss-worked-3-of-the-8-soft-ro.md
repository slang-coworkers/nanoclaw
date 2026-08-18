---
title: "[approver/challenger-miss] Worked 3 of the 8 soft rows: slangpy#1084's four 'Investigate' flags all resolve to nits against source — the reusable workflow's own header documents `permissions: {}` as the required caller contract, so the flag inverted the intent"
type: learning
topic: slang-compiler
source: learnings/1785948569292-approver-challenger-miss-worked-3-of-the-8-soft-ro.md
---

# [approver/challenger-miss] Worked 3 of the 8 soft rows: slangpy#1084's four "Investigate" flags all resolve to nits against source — the reusable workflow's own header documents `permissions: {}` as the required caller contract, so the flag inverted the intent

# [approver/challenger-miss] Devin-only "Investigate" flags on a config PR, resolved by reading the callee

## Context

Eight rows from my ABSTAIN-vs-merged join were `APPROVE_WITH_NITS` with 2-4 gaps — held back
from the false-negative count pending individual Step-3 severity reads. Worked the three
`slangpy#1084` heads (*"Onboard slangpy to slang PR board-sync workflow"*, merged
2026-08-04, human `APPROVED`, 8 files, all `.github/**`).

All three were **Devin-only tier** (no bot review harvested), 0 bugs, flags-only, gap counts
growing 2 → 3 → 4 across heads as the PR added callers.

## Each flag, checked against source

| flag | verdict |
|---|---|
| `pr-checks-complete.yml:36-37` — *"do the `ci`/`checks` `workflow_run` names match real workflows?"* | **resolved.** Watches `"ci"`, `"checks"`; `ci.yml` → `name: ci`, `checks.yml` → `name: checks`. Exact match. |
| `pr-maintenance.yml:46-57` — *"`permissions: {}` depends on the reusable workflow"* | **resolved, and the flag inverts the intent** (below). |
| `pr-maintenance.yml:55-57` — board/field IDs now depend on the callee's defaults | **advisory.** Callee header: *"every input below already defaults to the shared board's values; callers pass only the one secret."* Documented, intentional. |
| `pr-maintenance.yml:56-57` — the deleted `add-pr-to-project.yml`'s secrets | **advisory.** Single mapped secret `SLANG_PR_BOT_TOKEN`, matching the documented contract. |

The `permissions: {}` one is the instructive case. Read as a hazard ("depends on the callee
being correct"), it is actually **the callee's explicitly documented requirement** —
`shader-slang/slang/.github/workflows/pr-board-sync.yml:48-57`:

> *"Cross-repo reuse: any shader-slang repo adds a thin caller workflow … mapping the single
> required secret explicitly (no `secrets: inherit`; **callers should set `permissions: {}`**
> because this workflow uses the PAT for everything, not the GITHUB_TOKEN)"*

followed by a code block identical to what #1084 wrote. The callee itself also sets
`permissions: {}` (`:177`). So the caller is **conforming to a published contract**, and the
flag would have pushed toward *granting* permissions the design deliberately withholds — the
less safe direction.

## Root cause of the flag class

A reviewer seeing only the **caller** diff observes "empty permissions + a secret handed to
someone else's workflow" and correctly notes an unverified dependency. The resolution lives
entirely in the **callee**, one repo over. Nothing in the diff signals that the callee
documents this exact pattern — so the flag is a rational output of a caller-only view.

Generalizes: **for a PR that delegates (reusable workflow, shared action, library call),
severity cannot be judged from the caller alone.** Read the callee's contract before
promoting a delegation flag to a gap. Cheap here: two `gh api contents` calls.

Same shape as the earlier CI-coverage finding on this PR's sibling — *a check that only ever
sees one side of a join cannot see a join defect* — except inverted: here the one-sided view
manufactures a *concern* rather than missing one.

## Outcome

**All three `#1084` heads: `ABSTAIN_POLICY` was the wrong reason but the right disposition is
`WOULD_APPROVE`** — 0 bugs, all four flags resolve to nits or documented design. Human
outcome agrees (merged, `APPROVED`).

⇒ Adds three rows to the false-negative set, all from the *staging-fallback* clause failure
(`no_protected_paths` on `.github/**` under the stale pin). Not new causes — same mechanism
as #925/#918, now with Step-3 confirmation that nothing downstream would have blocked them.

**Not stamping or re-recording these**: the ledger question is open pending an operator grep,
and the `head_advanced` hazard means backfills must be driven from ledger-held shas, not
workspace-derived ones. Findings recorded; writes held.

Remaining soft rows: `#1002`@49b57f66b242, `#1078`@06e7ddad232a, `samples#57`×3.

Siblings: the ABSTAIN-vs-merged join entry; "a check that only sees one side of a join";
the staging-fallback entry.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785948569292-approver-challenger-miss-worked-3-of-the-8-soft-ro.md`_
