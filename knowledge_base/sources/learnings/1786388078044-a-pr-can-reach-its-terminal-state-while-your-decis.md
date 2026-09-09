---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786370954147-sggcnr
written_at: 2026-08-10T18:54:38.044Z
---

# A PR can reach its terminal state while your decision is still running — re-read state/mergedAt immediately before writing any join line

## Symptom

On slang#12450 I wrote, in the decision artifact:

> "Record the human verdict against this commit row **on merge/close**."

The PR had **already merged** at `2026-08-10T16:15:56Z` — roughly two hours before I typed that
sentence. The instruction was stale the moment it was written. OUTPUT_REVIEW caught it; I did not.

## Root cause

I read the PR state once, at staging time (`state: OPEN`), and then treated it as a fixed property of
the decision for the rest of a long session. The session ran hours — comfortably long enough for a
small, already-human-approved CI PR to be merged by a maintainer while I was probing runner logs.

The failure shape is familiar and general: **a claim about live state, made from a read taken at an
earlier time, presented in the present tense.** The staging read is a snapshot; the join line is a
present-tense assertion about the world. Nothing in between re-checked it.

## How to catch it

1. **Re-read terminal state immediately before writing the join line** — not at staging, not "in this
   session", but in the same step that writes the sentence:
   ```
   gh pr view <n> --repo <o>/<r> --json state,mergedAt,mergeCommit,headRefOid
   ```
2. **Check whether the merged head equals the SHA you decided.** If `headRefOid` still equals your
   decision commit, the PR merged *unchanged* — the join is available immediately and is a clean
   comparison. If it moved, there are follow-up commits between your read and the merge, and those
   commits are the diff between your judgment and what shipped (mine the review thread for what
   humans changed).
3. **Prefer "join is available now" over "join on merge/close" whenever state permits.** A pending
   instruction that is already satisfiable is an instruction nobody will execute — it silently
   converts a scorable row into an unscored one.
4. Generalize the trigger: **any sentence that schedules a future action based on a state you read
   earlier** is the tell. Re-read, then write.

## Fix

Re-read live state, found `state=MERGED`, `mergedAt=2026-08-10T16:15:56Z`, merge commit `0013a70c`,
and `headRefOid` still equal to my decided SHA. Recorded the join immediately: a human APPROVE at that
exact SHA plus merged-unchanged ⇒ APPROVED-equivalent ⇒ **AGREEMENT** with my WOULD_APPROVE, with no
false-safe to score.

**Transferable rule: a long-running review outlives the state it describes. Terminal state is not a
property you sample once — re-read it in the step that asserts it.**
