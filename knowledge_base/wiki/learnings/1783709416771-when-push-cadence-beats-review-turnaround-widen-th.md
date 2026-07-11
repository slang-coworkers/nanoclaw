---
title: "When push cadence beats review turnaround, widen the quiescence window — don't chase per-push"
type: learning
topic: review-process
source: learnings/1783709416771-when-push-cadence-beats-review-turnaround-widen-th.md
---

# When push cadence beats review turnaround, widen the quiescence window — don't chase per-push

**Rule:** If a PR author pushes real code changes *faster* than the review/approve turnaround (~25-40 min for a full A+C review), per-push re-dispatch is a losing race: every review lands on a tip that already moved, so it's stale on arrival AND wastes budget (~$27/review). The fix is to STOP re-dispatching per push, HOLD, and arm a host-side quiescence poll whose window is **longer than the observed push cadence**. A 15-min window is wrong when the author pushes every ~20-25 min — it fires mid-gap and re-dispatches into more churn. Size the window above the inter-push interval (e.g. 30 min for ~20-25 min cadence).

**Why:** shader-slang/slang PR #12031 (2026-07-10, kaizhangNV). After the review posted, the author entered sustained iteration addressing feedback: 34a481d→1d7fb0b→c5686341→19b24a60…, each a *real* diff change ~20-25 min apart. The approver dispatched R2 against 1d7fb0b; before it could finish, the tip moved twice. Chasing each push would have burned N stale reviews. Switched to HOLD + a 30-min-window host-side poll (`ncl tasks create`, guard emits diff_sha256 so the approver can reuse an archived doc if a settled tip is byte-identical to a prior baseline, else re-dispatch ONE fresh review).

**How to apply:**
- Detect the pattern: ≥2 real diff-hash changes within one review turnaround = cadence-beats-review. (Distinguish from rebase-only pushes — compare `sha256(gh pr diff)`, not `head.sha`; a rebase keeps the diff hash constant.)
- HOLD the reviewer/approver: tell it to stop per-push re-dispatch, archive any in-flight doc as stale-don't-decide-from, and wait for a poll ping as its sole resume trigger.
- Arm the poll with window > observed inter-push interval. Guard returns settled HEAD + diff_sha256 + age; wake only at age ≥ window (or close/merge). Poll self-cancels after the quiesced wake.
- On wake, reuse-or-redispatch by diff-hash match against archived baselines — never review byte-identical code twice.
- Nobody is blocked by the hold when the PR is maintainer-authored (the author isn't waiting on our review to keep working) — so a long window costs nothing but saves reviews. See [[In-container watches die on exit — quiescence detection must be host-side]] and [[Verdict-detection guards must page or query by author, not read reviews page 1]].

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1783709416771-when-push-cadence-beats-review-turnaround-widen-th.md`_
