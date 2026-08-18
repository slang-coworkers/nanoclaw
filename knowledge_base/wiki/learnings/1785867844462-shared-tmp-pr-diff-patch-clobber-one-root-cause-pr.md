---
title: "Shared tmp/pr-diff.patch clobber: one root cause producing a loud false positive AND a silently wrong review"
type: learning
topic: ci-tooling
source: learnings/1785867844462-shared-tmp-pr-diff-patch-clobber-one-root-cause-pr.md
---

# Shared tmp/pr-diff.patch clobber: one root cause producing a loud false positive AND a silently wrong review

Measured 2026-08-04 on slang#12269; **5th+ occurrence** of the same defect.

## The defect

The PR-review pipeline stages its diff at a **shared, non-run-scoped path** (`tmp/pr-diff.patch`). Two concurrent PR reviews clobber each other's file mid-run.

## Two failure shapes from one root cause

- **LOUD:** the integrity guard tripped `INTEGRITY-FAIL` — it diffs the shared file, which by then listed a *different* PR's files (`slang-compiler-options.cpp`, `unit-test-stdin-compile.cpp`). Adjudicated a **false positive**: the run's own `pr-diff.reference` held exactly the right two files and its footer pinned the correct head + `diff sha256`.
- **SILENT:** in the same run, a `code-quality-reviewer` subagent **reviewed the wrong PR (#12271)** while believing it had read the correct diff. Output unusable; that dimension had to be re-covered by hand.

## The load-bearing lesson

⭐⭐⭐**The recurring false positive trains you to dismiss the guard exactly when it is also producing wrong output.** After N adjudicated false alarms, `INTEGRITY-FAIL` reads as noise — but in this run it was *correctly detecting* real cross-contamination that had already corrupted a reviewer's output. **A guard whose true positives are indistinguishable from its false positives is worse than no guard, because the dismissal habit is the damage.** Same family as an inert guard that reads as passing.

## Discriminator (use this instead of dismissing)

Do **not** compare against the shared file. Compare the run's **own captured reference** (`pr-diff.reference`) plus the **footer-pinned head sha + diff hash** against live head. If those match the PR under review, the complaint is about the shared file — not your diff. If they *don't*, you have real contamination and any subagent output from that run is suspect.

## Fix

**Worktree-per-run isolation** (already in the operator queue — this is additional evidence). Interim mitigation: scope the diff filename by PR number + head sha.

**Also worth knowing:** drift was 0 in the affected run (zero GitHub-write tool calls). The clobber corrupts *inputs*; it did not cause stray writes. So the blast radius is wrong-analysis, not wrong-posting — which is precisely why it can pass unnoticed.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785867844462-shared-tmp-pr-diff-patch-clobber-one-root-cause-pr.md`_
