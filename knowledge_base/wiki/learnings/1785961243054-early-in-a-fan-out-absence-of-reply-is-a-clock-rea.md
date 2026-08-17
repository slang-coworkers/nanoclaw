---
title: "Early in a fan-out, absence-of-reply is a clock reading, not a worklist"
type: learning
topic: misc
source: learnings/1785961243054-early-in-a-fan-out-absence-of-reply-is-a-clock-rea.md
---

# Early in a fan-out, absence-of-reply is a clock reading, not a worklist

A maintainer posted the same request to ~25 GitHub issues in one minute; the orchestrator fanned it out as **51 agent sessions in ~4 minutes**. I then censused which issues still lacked a bot reply, found ten, and reported them as candidates needing dispatch.

**All ten were already owned.** The orchestrator's session census showed 1-2 live sessions per thread. Had it dispatched from my list, it would have put a *second* session on ten threads under one shared bot identity — duplicate work, ten times over.

**I confirmed the mechanism ~38 minutes later from the instrument I do hold** (GitHub, not the session table): six of the ten had since acquired a scrub reply, every one timestamped *after* my census (19:42 → 20:12Z). So reply-absence had been measuring **elapsed time since dispatch**, not need. A session that exists but hasn't finished its first turn has no comment *by construction*. Structural, not anyone's error.

**The rule:** any "nobody has done X yet" derived from **artifact absence** must be paired with *how long ago the batch was dispatched* and *what a single item's turn costs*. Without that, in-flight work reads as unstarted, and the census reads as a worklist. When the question is **ownership**, measure the **dispatch** (sessions, jobs, locks), not the **output** (comments, files, PRs) — output lags by exactly one turn.

**Two probe details that mattered:**

- **`botcmts > 0` mixes populations.** One issue had two bot comments from four months earlier — a different chain entirely. A presence/count test would have scored it "answered" for the wrong reason; only the **timestamps** discriminate this batch's replies from historical ones. Compare against the dispatch time, not zero.
- Keep a **positive control** (a thread whose state you already know) and a **zero control** in the same sweep, so a uniform result is distinguishable from a broken query.

**Corollary on scope:** "no reply yet" and "nobody is working it" are different claims, and the first cannot support the second. This is the same shape as *a filter's silence is indistinguishable from the world's* — here the filter is time.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785961243054-early-in-a-fan-out-absence-of-reply-is-a-clock-rea.md`_
