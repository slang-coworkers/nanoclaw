# [approver/clause-gap] Run Step 1 before honoring a named investigative request — the cheap clause can settle the decision the expensive probe was asked for

## Symptom

slang#12345 ("Update generated design docs") arrived with a specific,
well-reasoned investigative request: check whether the generated-doc
*regeneration path* was respected rather than files being hand-edited, framed
explicitly as "a clause-level concern, not a style nit", plus a pre-authorized
`ABSTAIN_INFRA` if bot review input hadn't landed on the fresh `opened` event.

Both were moot. One `gh pr view --json changedFiles` call: **177 files against
a cap of 150** ⇒ `tier_eligible` FAIL ⇒ `ABSTAIN_POLICY`, terminal. Honoring
the named probe first would have burned a `collect-reviews.sh` pass plus a
Devin browser run (the two most expensive steps in the workflow) on a PR the
procedure had already routed to a human.

## Root cause

Step-1 clauses are *mechanical predicates over PR metadata* and cost one or two
`gh` reads. Everything downstream — harvest, Devin, review-doc synthesis,
challenger — costs orders of magnitude more. SKILL.md:57 makes a clause FAIL
terminal and :75 gates the challenger on Steps 1–2 passing, so the ordering is
already mandated. The pull toward doing it backwards comes from the tasking
message being *specific and substantive*: a named probe reads as the real work,
and the clause script reads as boilerplate to get past.

## How to catch it

Run `eval-clauses.py` **first**, always, before any expensive input-building —
even when the dispatch names a particular thing to investigate. Then two
follow-ups that are easy to skip:

1. **Carry the named request forward in the derivation.** A terminal abstain is
   not permission to silently drop what was explicitly asked. Record it as
   *unprobed, with the reason it wasn't probed* — in #12345 the two carried
   items (hand-edit-vs-regeneration, provenance-field sync) went into
   `investigation.md` under "Carried forward", so a future revision's decider
   inherits them instead of rediscovering them.
2. **Check where the request belongs before accepting its framing.** The
   dispatch called the hand-edit check "clause-level". It isn't: it requires
   reading the diff, and a diff-reading predicate in Step 1 evaluates
   `unevaluable` and lands a spurious `ABSTAIN_INFRA` on **every** PR. Its seat
   is the Step-3 challenger. The framing was ~90% right and wrong on the one
   thing that would have broken the pipeline — the general form is that
   anything arriving as *context* rather than as a *claim* gets read past.

## Fix

Order is: clauses → (only if all pass) harvest/Devin → synthesis → challenger.
A named investigative request changes *what the challenger probes*, never
*whether Step 1 runs first*. When the clauses terminate the decision, the named
request converts from a task into a carried-forward note.

Prior art this replays exactly: slang#11979 (same `tier_eligible` FAIL with a
subordinate `commit_match=unevaluable`), slangpy#1085 (large low-risk diff,
benign terminal abstain, human merged at the decided head). In #12345 the human
join closed 60 seconds after the PR opened — `jvepsalainen-nv` APPROVED the
exact decided commit — which is the expected shape: an abstain a human approves
is a *routing* decision, not a code judgment, and these rows are excluded from
agreement scoring.
