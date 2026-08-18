---
title: "A frequency ranking over a 7d window cannot answer 'should someone act now' — check each signature's LAST fire and whether its tracking issue is CLOSED"
type: learning
topic: misc
source: learnings/1786199392008-a-frequency-ranking-over-a-7d-window-cannot-answer.md
---

# A frequency ranking over a 7d window cannot answer "should someone act now" — check each signature's LAST fire and whether its tracking issue is CLOSED

Recurring, reproduced twice in 34h (shader-slang CI sweeps, 2026-08-07 and 2026-08-08). A ranked "top flake signatures, last 7 days" list gets relayed to a human as *what to fix next* — but a 7-day frequency window is dominated by whatever was broken **earliest** in it, and a defect fixed on day 2 still ranks #2 on day 7.

**2026-08-08 instance:** I ranked `#12341 SLANGWIN5 spirv-val 0/866` at 10 of 40 rerun events and recommended "pull SLANGWIN5 from the pool." The issue had been **closed `state_reason=completed` on 08-05 21:39Z** — and my own newest row for it (22:15Z) says *"SLANGWIN5 verifiably recovered at 21:45Z (866/866), breaking the 12-fail/0-pass streak."* Zero occurrences in the 2.7 days since. The recommendation was infra action against an already-fixed defect. Splitting the same window: 08-01→08-05 = 18 reruns (spirv-val 10), 08-06→08-07 = 20 (outage 12, spirv-val **0**), 08-08 = 2 (spirv-val **0**). Every top-3 signature was a *past* driver (outage ended, spirv-val fixed, GBuffer last fired 08-07).

**Three cheap guards before recommending action from any frequency ranking:**
1. **Print `LAST` alongside `n` for every bucket.** `n=10, last=3 days ago` refutes itself on sight; `n=10` alone reads as live. Sort the *recommendation* by recency-of-last-fire, not by count.
2. **Resolve every tracking identifier and read its state.** A `#NNNNN` in your own prose is unverified until probed — and `closed` inverts the recommendation. Note `gh api repos/O/R/pulls/N` **404s for an issue number**; `issues/N` serves both, with `.pull_request` present only for PRs. Citing an issue as a PR is what makes a report 404 for the reader.
3. **Keep the frequency question and the action question on separate windows** ("how often has this hurt us" = long; "should someone act now" = current, ~48h). Never let one list answer both.

**Why it survives correction:** a stale-but-real signature passes every consistency check — the rows exist, the count is right, the signature text is verbatim. Nothing in the arithmetic is wrong, so re-deriving the same number feels like vindication. Only the **time-boundedness of the conclusion** is false, and the error pushes toward *recommending unnecessary work* against a named piece of infrastructure — a maintainer sent to quarantine a healthy runner. Related: [[a window is not a property]]; a ratio or rank from a windowed listing describes the window.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786199392008-a-frequency-ranking-over-a-7d-window-cannot-answer.md`_
