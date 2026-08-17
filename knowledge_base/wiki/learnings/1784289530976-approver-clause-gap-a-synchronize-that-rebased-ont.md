---
title: "[approver/clause-gap] a synchronize that rebased onto newer master: classify by the PR's OWN merge-base…head diff, never the compare-vs-prior-head"
type: learning
topic: review-approval
source: learnings/1784289530976-approver-clause-gap-a-synchronize-that-rebased-ont.md
---

# [approver/clause-gap] a synchronize that rebased onto newer master: classify by the PR's OWN merge-base…head diff, never the compare-vs-prior-head

**Symptom:** slang#12034 R5 arrived as a `synchronize`. The naive delta (`gh api compare/<prior-head>...<new-head>`) showed **62 commits and hundreds of files** touched — including `.github/**`, `external/`, `docs/`, dozens of `source/slang/*.cpp`. Taken at face value this looks like a massive, protected-path-touching, unreviewable change → would wrongly trip `no_protected_paths` and blow the size caps. In reality the PR's authored change was still the SAME 7 files as the prior revision (`slang-lower-to-ir.cpp` + 6 tests).

**Root cause:** When a PR branch is **rebased onto (or has master merged into) a newer base**, `compare/<prior-head>...<new-head>` includes ALL the intervening base-branch commits, not just what the PR author changed. The prior head and the new head have different merge-bases, so the two-dot compare between them conflates "the PR's new work" with "3 days of master". The PR's true authored footprint is `compare/<merge-base>...<head>` where merge-base = `compare(base_branch, head).merge_base_commit.sha`.

**How to catch it:** On EVERY synchronize re-run, before classifying the delta or trusting `eval-clauses.py`'s path/size clauses:
1. Get the PR's real base: `gh pr view N --json baseRefName`.
2. Compute the merge-base: `gh api repos/O/R/compare/<base>...<head> --jq .merge_base_commit.sha`.
3. Classify against the PR's OWN diff: `gh api repos/O/R/compare/<merge-base>...<head> --jq '{ahead_by, files}'`. `ahead_by:1` with a squashed commit = the PR was squash+rebased; the file list here is the authored change.
4. Cross-check `gh pr view N --json commits` — a single squashed commit + `ahead_by:1` confirms rebase/squash, not new content.
Signals you're looking at a rebase: `mergeStateStatus` was BEHIND, the compare shows `external/` submodule bumps + `.github/` churn unrelated to the PR's topic, and the PR commit count collapsed (R1–R4 → 1 squashed commit).

**Bonus (dedup-parity):** the R5 rebase also pulled in master's BOM-stripping (#12055): the PR's disk-load fallback switched to `SourceFile::decodeContentBlob()`, which `setContents()` also uses — so disk-loaded content now decodes identically to in-memory `getContent()`, IMPROVING the two-producer operand parity the dedup relies on. When a rebase pulls a shared helper into a path you're reasoning about, re-verify the equivalence still holds (it improved here).

**Fix:** `eval-clauses.py` already computes changed paths for the pinned commit correctly (its `no_protected_paths` passed on the 7-file own-diff, not the rebase compare) — but the HUMAN/agent classification step must not eyeball the raw compare-vs-prior-head. Always reduce a synchronize to the merge-base…head diff first; a big compare after a rebase is base-branch noise, not PR scope.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784289530976-approver-clause-gap-a-synchronize-that-rebased-ont.md`_
