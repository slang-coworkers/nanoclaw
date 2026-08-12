# Check a set for in-flight coverage before offering to fan out over it

# "Nobody has acted" is a claim about the world, not an inference from a stale field

**Incident (slangpy, 2026-08-05).** A maintainer told us an engineer wouldn't be returning and asked
us to scrub one issue. I reasoned — correctly — that the resume gate on that chain was void, and
generalized: the same engineer was assignee on 7 other open issues, several milestones stale, so
those sit on the same void gate. I closed my report offering to *"dispatch scrubs for the remaining
seven."*

**All seven had already been scrubbed.** Bot comments on every one, timestamped 19:04–20:43Z —
several posted *before* I made the offer. Same maintainer request, same verified HEAD, and to a
higher standard than my own chain in places: one found the feature was already **fixed** and
recommended closing; another found a **live test guard still citing the issue by URL**, which is
better evidence than the issue I'd been working had.

Had I dispatched, I'd have duplicated seven live chains on a maintainer's request.

## The error

Two independent facts got collapsed into one:

1. **The gate is void** — the assignee isn't coming back. True, and I verified it.
2. **Nobody is working these** — false, and I never checked.

`assignees` doesn't say who is working an issue. It also doesn't say who **isn't**. I'd just
learned the first half of that lesson (a stale assignee field can't tell you a gate is dead) and
then committed the mirror-image error: treating the same stale field as evidence of *absence of
activity*.

> **Before offering to fan out over a set, check the set for existing coverage.** One call per item:
> `gh api repos/<repo>/issues/<n>/comments --jq '[.[]][-1] | "\(.user.login) @\(.created_at)"'`

## I got lucky, and for the wrong reason

I *offered* rather than dispatching, so nothing landed. And my instinct to stagger the fan-out was
right — but I justified it with rate limits, when the actual hazard was duplication. A correct
precaution held for the wrong reason won't generalize to the next case.

> When you catch yourself proposing a fan-out because a *field* looks unattended, the missing step
> is always the same: look at the artifacts, not the metadata.

## Adjacent finding, worth its own note

One sibling comment had been **amended six times** in place, and a PATCH nearly destroyed it when a
rate-limited read returned an empty body.

> **Edit-in-place has a re-edit ceiling.** Each amendment risks the artifact a human actually reads.
> Prefer a new comment over an Nth in-place edit — and never write back a body you just read as
> empty.

## Related

- A hold waiting on a named person carries an unstated liveness premise.
- A provider error names the turn it killed, not the state of the task.
