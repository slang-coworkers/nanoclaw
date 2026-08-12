---
title: "A durable record is not a due action — armed checks need a consumer on the report path"
type: learning
topic: misc
source: learnings/1786257122553-a-durable-record-is-not-a-due-action-armed-checks-.md
---

# A durable record is not a due action — armed checks need a consumer on the report path

## The failure

I armed a background monitor on a nightly CI workflow with genuinely correct coverage: it fired on success, on *any* non-success terminal state, and on a hang timeout — so silence could not be mistaken for good news. I also committed to reporting the outcome either way. Then the next sweep went out without mentioning it, and the operator had to check the run himself.

The monitor design was not the defect. Durability was not the defect either — I had logged it as an outstanding check in an append-only ledger specifically so it would survive a context compaction.

**The defect: I made the check durable without making it *due*.** A pending check that isn't on the sweep's own emit list is invisible at exactly the moment it completes.

## The shape to recognize

This was the *third* instance of the same shape in one day, on the same codebase:

| mechanism | stored correctly | consumed | result |
|---|---|---|---|
| `terminal_unclassifiable` skip marks | 17 PRs marked | nothing read the key | triage stayed at 22 PRs instead of 5 |
| `labels[]` on ledger rows | specified in README as required | 0 of 1855 rows carried it | rankings tallied a residual |
| armed nightly monitor | ledger note, compaction-proof | no sweep step read it | resolved silently |

Every one: **the record existed, nothing consumed it.** A rule stored where nothing executes it is not landed. Prose in a README, a note in a log, a convention in a template — none of these are enforcement.

## The fix that actually works

Put a consumer on a path the work *cannot avoid taking*. For a periodic sweep, the summary write is unavoidable, so the guard lives there:

```python
def _require_outstanding_resolved(row):
    pending = outstanding_keys()          # read the REGISTER ON DISK,
    if not pending: return                # not anything the row asserts
    reported = row.get("outstanding") or {}
    missing = [k for k in pending if not str(reported.get(k, "")).strip()]
    if missing:
        raise ValueError("summary does not report armed check(s) %s" % missing)
```

wired into the row writer via the existing summary hook. Now an armed check makes the next sweep summary **unwritable** until it reports an outcome or explicitly restates it as still pending. Both are reportable; silence is not.

Key detail: the guard reads the register **on disk**, never a field the row supplies — otherwise a summary satisfies it by claiming nothing was armed, which is the self-confirming zero all over again.

## Prove the guard fires, and prove it has an exit

Five controls, because a guard you can't demonstrate firing is worth nothing — and one that rejects everything is just as broken:

1. armed + unreported → **rejected** (fires on the real input)
2. armed + outcome reported → **accepted** (working exit, not a dead end)
3. armed + *blank* outcome → **rejected** (silence dressed as a report)
4. `resolve_check()` on a never-armed key → **rejected** (can't claim coverage you never had)
5. empty register → passes (no false positives)

Control 3 matters more than it looks: without it, `{"key": ""}` satisfies the schema and you're back where you started.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786257122553-a-durable-record-is-not-a-due-action-armed-checks-.md`_
