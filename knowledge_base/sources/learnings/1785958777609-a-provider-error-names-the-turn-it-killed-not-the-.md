# A provider error names the turn it killed, not the state of the task

# Read the deliverable before re-driving a failed handoff

**Incident (slangpy#823, 2026-08-05).** A dispatched scrub returned
`API Error: Request rejected (429) · status code (no body)`. I checked the GitHub artifact: nothing
posted, request unanswered — work genuinely lost. Re-drove it, pinned to the live session.

~29 minutes later, **the identical error arrived again on the same chain.** The obvious read is "the
re-drive also failed, go again." It was wrong. The artifact check showed a new comment posted at
19:13Z — **the scrub had completed.** The second 429 killed a *later* turn, almost certainly the
report-back to me. Same error string, opposite remediation:

| occurrence | artifact | what was lost | correct action |
|---|---|---|---|
| 1st 429 | 0 comments added | the whole task | re-drive |
| 2nd 429 | comment present | only the status report | **do nothing** |

> **A provider error tells you a turn died. It tells you nothing about how far the task got.**
> Read the deliverable — the artifact outside the messaging channel — before deciding to re-drive.

Re-driving on the second one would have produced a duplicate comment on a maintainer's direct
request. What made the re-drive safe in the first place was attaching an explicit instruction to
the dispatch: *check for an existing reply first; if one exists, edit in place rather than posting a
second.* Worth doing on every redrive, because the host may also redrive the same handoff
independently — you and the host can both be re-driving one task.

## The ambient-vs-specific check, before diagnosing at all

`ncl sessions list` showed **56 sessions created in a 3-minute window** fleet-wide. The 429 was a
burst artifact, not a property of this chain. A per-chain post-mortem on an ambient failure invents
a false cause and wastes the turn.

> **Ask whether a failure is yours or ambient before diagnosing it.**

## Companion finding: a hand-typed list defines its own coverage

In the same scrub, the coworker generalized correctly — the absent engineer is assignee on other
stalled issues too, so a single-issue scrub leaves the rest on a void gate. Good instinct. But the
list was hand-typed as "6 other" items, and enumerating from the API returned **8** — the two it
missed included the *oldest* one (three quarters stale), i.e. the single best piece of evidence for
the point being made.

> **Enumerate candidate sets from source; never hand-type them.** An undercount doesn't just lose
> rows, it weakens the argument the list was offered to support. Also check the scoping predicate:
> a set enumerated by *assignee* is not the same set as one described by *label*.

## Related

- Watch the deliverable, not the worker — a health signal your own actions can perturb can't
  measure the other party.
- A hold waiting on a named person carries an unstated liveness premise.
