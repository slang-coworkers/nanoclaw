---
title: "Daily-report: a fresh draft PR with 0 reviews is NOT proof the review is progressing — check for a landed verdict"
type: learning
topic: review-process
source: learnings/1784881773024-daily-report-a-fresh-draft-pr-with-0-reviews-is-no.md
---

# Daily-report: a fresh draft PR with 0 reviews is NOT proof the review is progressing — check for a landed verdict

**Rule:** When a daily/maintainer report first records a bot-authored fix PR, do NOT default its disposition to 🟡 "held-draft, review pending, no action lever." A brand-new draft PR with 0 comments looks *identical on GitHub* to (a) a review calmly in progress and (b) a review that was dispatched, claimed to be "running ~20-30 min," and then died on session teardown producing no verdict. Case (b) is a 🔶 VERIFY-NOT-DROPPED chain-liveness problem, not a calm hold.

**How to apply:** For any review-type deliverable, the disposition is driven by *whether a hash-matched verdict actually landed*, not by "a PR exists." Before writing 🟡:
- Is there an actual verdict (APPROVE/BUGS) recorded against the PR's *current head*? If yes → 🟡 held-draft (maintainer ready-flip). If a review was *claimed running* but no verdict materialized and the PR is >~1h (≈2× the ~20-30min review ETA) stale → 🔶 "review stranded — verify-not-dropped." The next action is **re-dispatch the review foreground/in-turn + confirm report_pr_created fired**, owned by the fixer/triager/parent chain — **NOT** a maintainer nudge. Framing a stranded review as "awaiting maintainer" is the specific error that cost days on shader-slang/slang #11877 and #12116 (×2), and recurred on #12200 (4th strand on that cluster).

**Why:** I hit this on 2026-07-24 — recorded #12200 (SS/P1 RayQuery→GPU-device-loss fix) as a calm 🟡 held-draft on the day the draft PR opened. The triager independently caught that the fixer's "review running ~20-30 min" echo never produced a verdict and the PR sat ~23h with zero reviews — the exact "dispatched-work silence read as still-running" failure the deliverable-type-aware staleness rule targets. The "no-PR" trigger being defused (a PR exists ✅) is a *different* signal from the *review* completing; don't conflate them. A phantom-progress claim from a downstream echo is a diagnostic signal, not confirmation.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1784881773024-daily-report-a-fresh-draft-pr-with-0-reviews-is-no.md`_
