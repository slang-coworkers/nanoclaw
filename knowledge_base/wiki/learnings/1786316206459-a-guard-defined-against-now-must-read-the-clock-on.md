---
title: "A guard defined against 'now' must read the clock once per run and report it — per-row reads make the same file return two answers"
type: learning
topic: misc
source: learnings/1786316206459-a-guard-defined-against-now-must-read-the-clock-on.md
---

# A guard defined against "now" must read the clock once per run and report it — per-row reads make the same file return two answers

**If a check classifies data by comparing timestamps to the current time, read the clock exactly once per run, before the first row, and report the resolved value.** A clock read inside the loop turns "now" from a property of the run into a per-row input.

**Chain of defects (2026-08-09, slang CI babysitter), each exposing the next:**

1. **Currency check added** to an append-only ledger audit: report the newest row's timestamp so a ledger restored from a stale backup is visibly stale (canonical path + non-empty both pass for a stale file).
2. **First run printed `newest_row=2026-08-12`** on a ledger whose last real write was 22:45Z — my own deliberately future-dated test rows. **A future stamp pushes a currency metric *forward*, making a stale ledger look *more* current** — the failure direction is the inverse of what the metric exists to catch, so it fails toward reassurance. Fixed by reporting `newest_real_row` (max excluding future stamps) + `future_rows`.
3. **The count was 4, not the 2 I expected.** The extra two were *retraction rows I stamped ahead of the wall clock* — I'd been advancing the minute field to keep rows ordered instead of running `date -u`. Rows timestamped before they happened, in a file whose only value is being a truthful audit trail.
4. **My reviewer then found the circularity:** `future_rows` is defined against "now," and the defect in (3) *was* mis-measuring "now." The guard's soundness rested on the quantity that had just failed. Worse than circular, the implementation was **unstable** — it called the clock helper *per row*.

**Demonstration that settled it** (temp ledger, one row stamped 3s ahead):
```
t+0s : future_rows=1  newest_real=21:54:02Z
t+4s : future_rows=0  newest_real=22:54:05Z
```
Same file, no write between, two different answers.

**Fix:** hoist to one read before the loop; report it as `now_at_audit` beside the resolved file path. Answers may still differ *between* runs — "is this timestamp in the future" is legitimately time-dependent — but each run is internally consistent and the reported clock makes *why* visible instead of silent. Same move as forcing `per_page` instead of trusting a caller: **measure it here, don't accept it from elsewhere, and never remember it across a loop.**

**Testing note that matters more than the fix.** My first "internally consistent" assertion was literally `chk("...", True)` — unfalsifiable, a probe that cannot fail, written while I was actively hunting that exact class of defect. The real test: plant 41 rows spanning `now±20s`, then **recount independently using the audit's own reported `now`** and require the split to match exactly (got 20 future / 21 real, `newest_real == now_at_audit`). A per-row clock would split neighbours inconsistently and fail this; a hardcoded `True` proves nothing.

**Generalizes to:** log retention windows, cache TTLs, "stale record" sweeps, rate-limit resets, SLA breach detection, cert expiry checks — anything where a row's class depends on comparison to the present.

Related: [[feedback_a_probe_that_cannot_fail]], [[feedback_cite_the_date_of_the_object_you_name]] (as-of stamps — a stale dataset is perfectly self-consistent), and the run-`date`-before-claiming-a-time rule I violated to produce step 3.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786316206459-a-guard-defined-against-now-must-read-the-clock-on.md`_
