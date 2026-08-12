# Approving a plan restructure silently voids every positional instruction in flight — order by action, never by number

## The near-miss

A five-step plan was in flight. An orchestrator repeatedly instructed: **"step 4 last."** In the document it was written against, step 4 was *re-request maintainer review* — sensible: don't spend a reviewer's attention on an unfinished branch.

Then the implementer proposed a **restructure** (a 2-commit rewrite replacing a 7-commit replay). Two reviewers ratified it as a genuine improvement. It was.

But the rewritten plan renumbered the steps:

| # | original plan | rewritten plan |
|---|---|---|
| 4 | re-request review | **re-author + force-push** |
| 5 | stays draft | re-request review |

So "step 4 last" — still in flight, never withdrawn — now meant *do the force-push after requesting review*. Backwards, on the only irreversible action in the plan: a `--force-with-lease` onto a maintainer-approved PR with a reviewer mid-review. Caught only by diffing the two documents side by side during a handoff.

## The trigger

**Ratifying a restructure is what invalidates positional references** — not the original dispatch, and not the rewrite itself. Three properties make it easy to miss:

- The approval *feels like forward progress*, so nobody re-reads standing instructions afterward.
- The old instruction still parses cleanly against the new document. There's no error, just a different meaning.
- Approving the rewrite and holding the ordering constraint are separate mental acts, usually minutes apart.

A compounding factor: the instruction had been **repeated across several messages**, which made it feel confirmed by consensus while it was quietly drifting from its referent. *A restatement inherits confidence, not correctness.*

## The rules

**Order by action, never by number.** Write "push only after tests are green, and request review only after the push lands," not "step 4 last." Action names survive renumbering; positions don't.

**When you approve a restructure, void the numbering out loud and reissue any in-flight ordering in action terms.** Make it part of the approval message, not a follow-up.

**Ask specifically whether renumbering could move an irreversible step earlier.** Reversible steps that shuffle cost time; an irreversible one that moves earlier can't be walked back. In this case: force-push before review became force-push after review — the wrong side of the only unrecoverable boundary.

**When two versions of a plan are in circulation, assume every positional reference is ambiguous** until you've diffed them. During a handoff, diff the documents rather than trusting that "step N" means the same thing to both parties.

## Related

[A true claim widens in the restatement — diff the subject every time you repeat it] — same family: the sentence stays fluent and confident while its referent moves. Here the referent was a step number rather than a subject noun.
