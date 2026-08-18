---
title: "Review deliverables need an ETA-relative staleness trigger, not the 48h dropped-deliverable window"
type: learning
topic: review-process
source: learnings/1784622307704-review-deliverables-need-an-eta-relative-staleness.md
---

# Review deliverables need an ETA-relative staleness trigger, not the 48h dropped-deliverable window

**Rule:** The watch-list 🔶 "verify-not-dropped" staleness check must key its trigger to **deliverable type**, not a single uniform window. A **review** (correctness/clarity verdict, ~20–30 min ETA) silent past **~2× its ETA (~1h)** with **no `running` owning reviewer session** is **stranded**, not running → flag 🔶 immediately. Do NOT reuse the generic **>48h** window for reviews — 48h is right only for **builds** (ninja resumes incrementally; legitimately long) and owed-answers.

**Also 🔶-flag a review when:** (a) the PR head moved after dispatch (dispatched SHA ≠ current head → must re-run regardless), or (b) a verdict came back but its reviewed-diff-hash ≠ current head (stale-bytes — as unsafe as no verdict for a `pr: breaking change` gate). "Review complete" = *hash-matched verdict against current head*, not merely "a verdict returned."

**🔶 for a review means the correctness gate has NOT completed** → the PR is NOT eligible for "maintainer ready-flip," and a breaking-change PR must never be framed as mergeable. Next action = **re-dispatch the review foreground/in-turn with bounded blocking calls** (completion = tool result, not a teardown-prone background monitor) — owned by parent/reviewer, NOT a maintainer nudge.

**Why:** 3 teardown-strands on one review-cluster (slang #12116 ×2, #12162) all read on GitHub as 🟡 "awaiting maintainer ready-flip" when the review had never completed. Root cause (learning 1783659090219): an in-container "I'll ping when the verdict lands" watch dies the moment its `--rm` container idles — its notification never fires. The uniform 48h window couldn't tell a 30-min-ETA review overdue by 2h from a multi-day build. The sibling `supervise-issues/scan.py` has a "bounce limb" (`any_stopped_errored`) that flips a `stopped`-container chain to nudge inside the fresh window, but only when the last outbound is **error-class** — a *clean* teardown (signal simply lost, no error text) slips through; that's the review-strand blind spot.

**How to apply:** In the daily-report/supervisor pass, for any watch item citing an in-flight review, do a liveness probe: `ncl sessions list --json` exposes per-session `container_status` (running/stopped) + `last_active`. `stopped`/absent + silent past ~2×ETA ⇒ 🔶. Fail toward re-verifying liveness (a false 🔶 costs only a cheap re-confirm). Fast-follow: generalize scan.py's bounce limb to catch clean (non-error) teardowns for review-type deliverables. Full plan: /workspace/agent/reports/review-staleness-trigger.md.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1784622307704-review-deliverables-need-an-eta-relative-staleness.md`_
