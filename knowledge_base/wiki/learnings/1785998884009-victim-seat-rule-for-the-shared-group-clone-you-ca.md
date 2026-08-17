---
title: "Victim-seat rule for the shared group clone: you cannot prevent a co-tenant reset, so never hold a working tree there"
type: learning
topic: misc
source: learnings/1785998884009-victim-seat-rule-for-the-shared-group-clone-you-ca.md
---

# Victim-seat rule for the shared group clone: you cannot prevent a co-tenant reset, so never hold a working tree there

# A shared-clone `reset --hard` has TWO seats — the existing rules only cover the perpetrator's

**Second instance, 2026-08-06, slang-triager on shader-slang/slang#12384.** A **co-tenant session — another instance of the same coworker** — ran `git reset --hard` on `/workspace/agent/slang` at ~06:41 while this session held an applied patch there. The patch was silently reverted mid-build; **four measurements were void.** Same clone, same coworker, one day after [[1785952248896-concurrent-sessions-of-one-coworker-share-the-grou]].

⚠️ **Say "co-tenant session", never "sibling session" or "another agent."** `/workspace/agent/<project>/` is per-agent-**group**, so the other party is almost certainly another instance of *you*. Both the first report of this incident and the first draft of this very file used "sibling", which reads as a different coworker and sends an operator hunting a cross-group bug that does not exist.

## Why this is a distinct lesson

That prior learning is written entirely from the **perpetrator's** seat: *don't chain a destructive op behind a status check; stop and report if `git status` shows work you didn't make.* Both rules are correct and both were followed here — **by the wrong party.** The session that lost work did nothing wrong. It had no rule available to it, because:

⇒ **You cannot prevent a co-tenant's reset.** `/workspace/agent/<project>/` is per-agent-**group**, not per-session; N of your own concurrent sessions are in that tree right now, each entitled to refresh it. A guard you run cannot constrain a command another session runs. **The only defense is not to be there.**

## Rules (victim seat)

1. **Any session that will hold state in the tree — an applied patch, a checked-out PR head, a build — starts by creating its own worktree.** `git worktree add /workspace/agent/slang-<task-key> <ref>`. Not "when contention appears": contention is unobservable until it has already cost you. The shared clone is safe for read-only inspection at whatever HEAD it happens to be, and for nothing else.
2. **The detection that worked was a contradiction, not an error.** No command failed; no log said anything — `BUILD_EXIT=0`, `[12/12] Linking`, a clean-looking result. The tell was **an empty `git diff` where a hunk was expected**: the source on disk disagreeing with the binary just built from it. ⇒ when a measurement surprises you in a shared clone, re-read the source you believe you measured before believing the result. Corollary of rule 3 in the prior learning (`git rev-parse HEAD` *after* the build), generalized: verify the **tree**, not just the SHA — a reverted patch can leave HEAD unchanged.

   ⛔ **Scope the re-assert to source paths, or the check manufactures false alarms.** `git diff --name-only | wc -l` on the isolated worktree returned **19** from legitimate `external/` submodule symlinking — indistinguishable, at a glance, from the drift this check exists to catch. "Expected hunks: 0" is false in any tree where you have done normal setup work. Use **`git status --porcelain source/`** (measured 0 in the same tree, while the unscoped count said 19); `git diff --name-only | grep -cv '^external/'` also discriminated. ⭐ **A whole-tree count is the wrong instrument for a question about your own edits — a check whose false-positive rate is set by unrelated setup work will be disbelieved exactly when it fires correctly.**
3. **Void the measurements, don't repair them.** Four cells taken across the revert boundary are not "probably still fine" — the reverting op is invisible in their provenance. Re-take them in the isolated worktree.
4. **When you report this, don't say "another agent" or "sibling session."** It is most likely another instance of *you* (see the prior learning's corrected read). Naming it as a foreign coworker sends the operator looking for a cross-group bug that isn't there.
5. **Capture the pristine baseline with the SAME script you will run against the patched tree.** Then the two columns are comparable by construction, and a mid-run revert cannot silently turn a comparison into a self-comparison. Include a cell whose expected outcome is *agreement* — on #12384 the "inner struct non-empty" shape reporting AGREE is what proved the harness could detect agreement at all, so the MISMATCH cells were real findings rather than a stuck instrument.

## Standing consequence

Two independent instances in two days, opposite seats, same clone. The perpetrator-side rules cannot close this — they depend on every session in the group having them and firing them, and the cost lands on a session that has no say. **Worktree isolation at session start is the structural fix**; the existing `/slang-pr-review` runners already do this for Reviewer A/C ([[1783635595122-slang-pr-review-concurrent-runs-clobber-shared-sta]], [[1782876940783-isolate-reviewer-c-in-a-git-worktree-for-parallel-]]) — the same discipline belongs in triage and fix work that patches the tree.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785998884009-victim-seat-rule-for-the-shared-group-clone-you-ca.md`_
