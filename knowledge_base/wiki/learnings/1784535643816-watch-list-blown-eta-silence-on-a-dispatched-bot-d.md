---
title: "Watch-list: blown-ETA silence on a dispatched bot deliverable = dropped-task signal, not 'still holding'"
type: learning
topic: misc
source: learnings/1784535643816-watch-list-blown-eta-silence-on-a-dispatched-bot-d.md
---

# Watch-list: blown-ETA silence on a dispatched bot deliverable = dropped-task signal, not "still holding"

**Rule:** When a maintainer watch-list item's disposition cites an *in-flight bot deliverable* (a fixer building a PR, a reviewer producing a verdict, an owed answer) and the owning session has had **no observable activity in >48h** (no PR, no verdict, `updated_at` frozen, no monitor ping), flag it **🔶 "verify not dropped — re-confirm the owning session is alive"**. Do NOT carry it as green/🟡 "progressing," and do NOT re-frame it as a maintainer nudge.

**Why:** Dispatched fixer/reviewer work can die on session teardown (the monitor completion notification is lost). On GitHub, a dropped chain looks *identical* to one calmly progressing — open issue, no PR/verdict, quiet. On 2026-07-20 the daily report carried **#11877** (fixer's error-diagnostic PR, mid-build 07-15) as "PR overdue → soft nudge to maintainer" and **#12116** (Reviewer A's re-run) as "draft awaiting maintainer ready-flip." Both were actually **dropped-on-teardown**: no PR / no verdict was ever produced. Framing a dropped deliverable as a maintainer nudge would have let it sit *another* cycle — there was nothing for a maintainer to do. Parent caught it and re-woke both sessions; the chains had been dark 5 days across a compaction gap.

**How to apply:**
1. Sharply distinguish **"maintainer-gated"** (fix/verdict EXISTS, only a human ready-flip/merge/alignment-reply remains → genuine 🟡, real maintainer nudge — e.g. #12095 ready, #12014 held, #11631 alignment) from **"deliverable dropped"** (no PR/verdict was ever produced by the owning bot session → 🔶, a chain-liveness problem, NEVER a maintainer nudge).
2. Any in-flight bot deliverable silent >48h → 🔶, surfaced to parent as "deliverable overdue — verify not dropped" so parent can re-wake the owning session. Only after the session is confirmed alive does it return to 🟡-held.
3. Blown-ETA silence is a dropped-task signal. A 5-day-dark chain must not be carried as "calmly progressing."

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1784535643816-watch-list-blown-eta-silence-on-a-dispatched-bot-d.md`_
