---
title: "Design-time detector: ask what input makes an assertion PASS while being maximally broken — 3 such checks found in one night, all inaction-biased"
type: learning
topic: misc
source: learnings/1786077201260-design-time-detector-ask-what-input-makes-an-asser.md
---

# Design-time detector: ask what input makes an assertion PASS while being maximally broken — 3 such checks found in one night, all inaction-biased

**2026-08-07.** In one debugging session, three separate integrity checks turned out to **pass on exactly the failure they existed to catch**:

| check | intended to catch | but it passes when… |
|---|---|---|
| `steps.length == 0` ⇒ "job never executed, exclude as untested" | jobs that never started | the job is simply **older than ~7-day log retention** — GitHub zeroes `steps[]`, so real aged failures read as untested |
| `rows_in_file == distinct_ids_in_file` | corrupted fetch output | the file is **truncated** — a truncated file satisfies it perfectly |
| `rows_written == total_count` | incomplete fetch | **both are 0** — "no work existed" is indistinguishable from "the fetch lost everything" |

⭐⭐⭐ **The generalisable detector, and it's checkable at design time rather than in postmortem: for every assertion you write, ask "what input makes this pass while being maximally broken?" If the answer is the thing you're guarding against, the assertion is decoration.**

This is stronger than noticing the bias after the fact, because you can run it while writing the check — no incident required.

**All three failed in the same direction: toward "fine, nothing to investigate."** That's not coincidence. A check that fails loudly on healthy input gets fixed in minutes; a check that passes silently on broken input has no feedback loop at all. Combine the two ideas: the assertions most worth re-examining are the ones that have **never fired**.

**Concrete remedies for the three above:**
- Perishable fields (`steps[]`, job logs) are valid discriminators **only inside the retention window**. Pair with an age guard, or bucket on durable fields (`status`/`conclusion`) and store the *derived* verdict with a date.
- Assert **completeness** (`rows == total_count`), not **shape** (`rows == distinct_ids`). The API hands you `total_count` — use it.
- Never let `0 == 0` count as verified. Pair the zero case with an explicit explanation assertion: the run's `status`/`conclusion` must account for the zero (e.g. `action_required` or `cancelled` runs genuinely dispatch no jobs — verified live for 4 such files).

**A second finding from the same sweep, about how these were discovered.** The four *newly* damaged files held 36, 36, 37, and 72 rows — the **modal** counts in a store where 254 files had 36 rows, 268 had 37, and 45 had 74. A row-count *distribution* cannot flag them; only comparison against the expected count can. So: **an anomaly detector keyed on the shape of your data is blind to damage that lands on the mode.** Prefer a per-item comparison against an independently-known expected value over any aggregate outlier hunt.

Related trap worth naming: **holding a finding in one frame doesn't mean applying it in another.** The "`action_required` runs emit zero jobs" behaviour was already on file (from an approval-blocked-fork investigation, where it made a held PR read as unconfigured) and still wasn't connected to the fetch-verification hole until someone else pointed at it.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786077201260-design-time-detector-ask-what-input-makes-an-asser.md`_
