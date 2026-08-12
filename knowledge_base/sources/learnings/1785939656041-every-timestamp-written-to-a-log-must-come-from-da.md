# Every timestamp written to a log must come from date -u at write time, never retyped

## The defect

Writing a plausible-looking ISO timestamp into an append-only log instead of reading the clock. Observed 2026-08-05: I stamped two `rerun-log.jsonl` rows `14:22:00Z` and `14:28:00Z` while the actual wall clock at write time was `14:19:08Z` — **both rows were in the future**. I only caught it because I ran `date -u` for an unrelated reason afterward.

## Why it is worse than an ordinary typo

- **Nothing rejects it.** A future timestamp is valid ISO-8601 and valid JSON. No parse error, no schema complaint, no downstream warning. It reads as evidence you gathered.
- **It corrupts exactly the analyses the log exists for.** An append-only decision journal is queried by *time* ("reruns per day", "was the eviction before or after the fix", "N occurrences in the last 7d"). A future row reorders events and can place an effect before its cause.
- **The values look self-consistent.** Round numbers (`:00Z`) and monotonically increasing values across rows look *more* trustworthy than real clock readings, which are ragged (`14:19:08Z`). Tidiness is the tell, not the reassurance.

## The rule

Read the clock at the moment of the write: `NOW=$(date -u '+%Y-%m-%dT%H:%M:%SZ')` and interpolate it. Never compute a timestamp by arithmetic ("that took about 6 minutes"), never carry one forward from earlier in the session, never round.

**Prefer the service's own timestamp when the event is remote.** For anything GitHub did, the authoritative value is in the API response — a posted comment's real time came back as `created_at: 2026-08-05T14:17:48Z` from `gh api repos/<o>/<r>/issues/comments/<id>`, and an eviction's from the `RemovedFromMergeQueueEvent.createdAt`. Your local clock at the time you *noticed* the event is not when it happened.

This is the same failure mode as retyping a value you "understand" rather than copying the emitted bytes — understanding the value is what licenses inventing it.

## Repairing it in an append-only file

Do not rewrite history. Append a correction row carrying `supersedes_ts` (the bad value), `excluded_reason` (why, plus the authoritative replacement), and an explicit "this row and the superseded row are ONE event — do not double-count." Any derivation over the file must honor `supersedes_ts` and dedup **last-wins**, or the correction is silently swallowed by a first-wins dedup that keeps the row you were trying to fix. Mutable state files (a cap tracker) are different — fix those in place and note the correction inline.

## Cheap standing check

Before ending a session that wrote timestamps, grep the rows you added and compare the max against `date -u`. Any row `> now` is a bug, and it takes one command to find.
