---
name: feedback_a_fix_suggestion_is_a_claim_needing_its_own_execution_check
description: "A remedy I attach to a finding is an unverified claim shipping under the finding's credibility — I nearly shipped a fix that would have silently overwritten a data point. Test the REMEDY, not just the defect."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 62d302da-c9ae-40de-ae7f-698f5b755918
---

# A fix suggestion is a claim, and it rides on the finding's credibility

⛔ **TRIGGER: I am about to write "suggest X" / "this should be Y" / "the fix is Z" next to a
finding I proved.** The finding got an execution check. **The remedy usually gets none** — and it
inherits the authority of the proof sitting above it.

## The instance (nanoclaw#1187, 2026-08-11)

I proved 🔴 by execution: `heartbeat_unixtime` is emitted from inside `collect_db()`, so any
earlier throw in that function silences the watchdog while every other panel keeps looking
current. Solid — reproduced with a synthetic DB.

Then I wrote the remedy: *"emit it from `main()`, unconditionally, outside the try/except."*
Plausible, one line, obviously correct-looking.

✅ **I tested the remedy before posting, and it was wrong.** Two `emit("nanoclaw_fleet", …)`
calls produce:

```
nanoclaw_fleet max_silence_sec=100i,sessions_running=3i
nanoclaw_fleet heartbeat_unixtime=1786429119i
```

Same measurement, **no tags, no explicit timestamp** ⇒ same series + same ingest-assigned
timestamp ⇒ in InfluxDB one **silently overwrites** the other. My fix would have destroyed the
fleet metrics to save the heartbeat — introducing a *new* silent-data-loss bug into a PR whose
entire subject is silent data loss.

Corrected to: put `heartbeat_unixtime` on `nanoclaw_collector`, which already emits
unconditionally from `main()`. No collision, one panel-query edit.

## Why this class is dangerous

⭐⭐⭐ **A remedy is the part the author is most likely to ACT on.** They can re-derive my
finding from their own code, but they will often just apply the suggested fix — so an unverified
remedy converts my credibility into their bug. The asymmetry is the point: **the finding costs
them a re-check, the remedy costs them a commit.**

⭐⭐ **"One line, obviously right" is the signal, not the exemption.** The remedy felt too small
to test. That smallness is exactly why it skipped the check — a multi-step fix would have
prompted me to run it.

## How to apply

- **Before shipping a remedy: name the check that would catch it being wrong, then run it.** For
  a code fix that is usually the same harness that proved the finding — I already had the
  collector loaded and executable; testing the fix cost one more `python3 -`.
- **If I cannot test it, say so in the review.** *"Untested suggestion:"* is cheap and keeps the
  remedy from borrowing the finding's authority.
- **Prefer a remedy whose mechanism the codebase already demonstrates.** `nanoclaw_collector`
  already emitted unconditionally from `main()` — pointing at a working in-repo instance is
  stronger than inventing a new emit site, and it is self-verifying.

Related: [[feedback_mechanism_must_predict_observed_coordinates]] (a mechanism must predict the
observed coordinates — a remedy must predict the post-fix state),
[[project_nanoclaw_1187_grafana_stack_into_git]].
