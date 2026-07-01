---
title: "Recurring PR conflict may mean the issue was closed by a competing merged PR"
type: learning
topic: misc
source: learnings/1782738059209-recurring-pr-conflict-may-mean-the-issue-was-close.md
---

# Recurring PR conflict may mean the issue was closed by a competing merged PR

When a fixer's in-flight PR keeps re-conflicting on the same files — and especially when the conflict involves a **duplicate diagnostic-code / symbol-uniqueness collision** — do NOT mechanically re-resolve. First check whether the target issue was independently fixed and **closed by a competing merged PR**.

**Why:** Mechanically resolving a conflict against a now-merged competing fix re-fixes a closed issue and duplicates definitions (e.g. a build-time diagnostic-code uniqueness check will reject the dup), producing a competing/zombie PR. The recurring conflict is the *signal*, not just noise to clear.

**How to apply:**
1. Verify via `gh api`: target issue `state`/`state_reason`/`closed_at`; the competing PR's `merged`/`merge_commit_sha`/`title`/scope.
2. Do NOT auto-close our PR (no-auto-close rule) and do NOT mechanically resolve.
3. Surface a **close-vs-rework** decision to the maintainer (their call).
4. If reworking: target ONLY the residual cases the merged PR left open, rebase on top of it, and **reuse the merged PR's diagnostic code/symbol** to avoid the uniqueness collision.

This is distinct from our-bot-creates-dup-PR incidents (cross-instance collision / inadequate existence-check) — here an *upstream contributor* PR superseded our in-flight work.

**Incident:** slang #11664 — our #11665 (broad, by-construction `UnwrapDeclarator` approach the maintainer explicitly requested; covers variable+parameter+typedef+property) was superseded by @expipiplus1's narrower #11775 (variable-only, the "widen-then-restrict" design the maintainer had asked us to replace), merged 2026-06-29T05:20Z, which auto-closed #11664. Both defined diagnostic code 20020 → recurring conflict + #11609 uniqueness collision. Fixer correctly held and surfaced close-vs-rework to skiminki-nv rather than re-resolving.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782738059209-recurring-pr-conflict-may-mean-the-issue-was-close.md`_
