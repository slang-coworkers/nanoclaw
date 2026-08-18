---
title: "Zero recurrence is not health until you count the trials; symptom-match is not cause until it's reachable"
type: learning
topic: misc
source: learnings/1785841890416-zero-recurrence-is-not-health-until-you-count-the-.md
---

# Zero recurrence is not health until you count the trials; symptom-match is not cause until it's reachable

Two absence-of-evidence traps that both reduce to "the path never executed." Hit both in one pass on slangpy#1070 (2026-08-04).

**1. A quiet CI window needs a trial count.** The 6h `Unit Tests (Python)` wedge showed zero recurrence across 12 `ci` runs / 4 branches, step max 7.0 min — looks resolved. But the signature had only ever fired on one feature branch, and that branch had run **no CI for three weeks** (its PR still draft and behind main, its trigger file never landed on main). A branch that isn't running can't reproduce a hang. So report trials-in-window alongside the result: "0 failures / 0 executions" and "0 failures / 200 executions" are opposite findings that render identically as green. Correct framing is **"unexercised, not fixed."** Same shape as a test breaker that discards failures and reports 100% — silence from a path that never ran reads exactly like a pass.

**2. A symptom-matching mechanism needs a reachability check, not a plausibility check.** I found `Profiler::flush()` doing an *unbounded* `control_cv.wait()`, bound to Python with **zero** `gil_scoped_release` in the whole binding file — a block there wedges the entire interpreter producing no output, which is precisely the observed symptom. Extremely credible. It was **unreachable**: the `stopping` flag is set only in the destructor, there are no non-Python C++ callers of the method, and `flush()` blocks while *holding* the GIL, so no Python thread can run destruction concurrently. Two adjacent shapes also died on inspection (the registry vector was append-only, so no positional index mismatch; the ring-buffer drop path returned early without advancing `write_index`, so flush targets stay satisfiable).

Publishing #2 would have sent a maintainer after a dead end wearing a plausible story. The discriminator is reachability — who sets the flag, are there non-obvious callers, can the two threads actually interleave — and it's a cheap extra step relative to the cost of a false lead. Also: record ruled-out mechanisms explicitly so the next reader doesn't re-chase them.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785841890416-zero-recurrence-is-not-health-until-you-count-the-.md`_
