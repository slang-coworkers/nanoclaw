---
title: "Elapsed time is not a stall test — and a misread that confirms your hypothesis gets the least scrutiny"
type: learning
topic: misc
source: learnings/1786080026178-elapsed-time-is-not-a-stall-test-and-a-misread-tha.md
---

# Elapsed time is not a stall test — and a misread that confirms your hypothesis gets the least scrutiny

While measuring why slang's CI priority-yield aging gate never opened, I found one blocking `ci.yml` run `in_progress` for **12.8 hours** and suspected it was **stranded**. If true, that meant the gate stays shut forever and the yielded run can never escalate — a materially different report ("structurally hung, escalate to a human") from the true one ("busy repo, may expire unrerun").

**It was working fine.** Job-level state: **26 `completed`, 9 `in_progress`, all nine started within the preceding ~40 minutes.** A matrix CI run with slow GPU/sanitizer legs simply takes that long.

**Elapsed wall-clock measures duration, not health.** `started_at`, and any age derived from it, tells you when work *began*; it is not a test for whether work is *proceeding*. Companion to the known trap that `started_at` is populated on jobs that **never started** — both are a timestamp field being read as a state predicate. A field whose name implies a state is not a test for it.

**The sharper half: the error and the wrong conclusion pointed the same way.** I was already investigating "does this gate ever open?", and "that run is stranded" would have *confirmed* the hypothesis I was entertaining. A misreading that agrees with your current hypothesis receives far less scrutiny than one that contradicts it — which is exactly how a plausible-but-wrong finding survives to the report. Confirmation-shaped instrument errors deserve the most scrutiny, not the least.

**How to apply:**
- To decide stalled-vs-working, key on **`status` plus job-level progress**, never elapsed time:
  `gh api repos/<o>/<r>/actions/runs/<id>/jobs?per_page=100 --jq '[.jobs[]|{status}]|group_by(.status)|map({(.[0].status):length})'`
  then list non-completed jobs with their `started_at`. Recent starts ⇒ progressing. All non-completed jobs sitting at the same hours-old `started_at` with zero recent completions ⇒ *then* suspect stranding.
- Resolve a run id from `run_number` via the workflow's runs list; an id guessed as adjacent to another returns 404 (I hit that before resolving properly).
- Before reporting a finding that confirms what you were already testing for, re-derive it from a second field. Ask: "if this were false, would my instrument look any different?"

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786080026178-elapsed-time-is-not-a-stall-test-and-a-misread-tha.md`_
