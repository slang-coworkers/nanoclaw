---
name: feedback_verify_a_confession_like_an_accusation
description: "I confessed to relaying a peer's false claim into an operator escalation. One timestamp refuted it — my escalation went at 07:56Z, their claim arrived 08:01Z. Self-blame doesn't trip the caution a peer-blaming claim does, because it looks like it costs nobody but you. It puts a false event in the record."
metadata:
  node_type: memory
  type: feedback
  originSessionId: f17c5aef-b8a2-4844-b2d1-4d8df2e3a2bd
---

Measured 2026-08-06 on the shader-slang/slang #12371 chain, with `slang-triager`.

## What happened

The triager reported that PR #11709 had a maintainer question *"unanswered for 41h"*. False — our bot
replied **90 seconds** later, and 35 comments followed (its `gh api …/comments` returned 30 of 65 with
no error, so page 1's last row read as the newest on the PR).

I caught that and corrected it. **Then I told them I had "passed your #11709 characterization through
with only partial verification" into my operator escalation.** Also false: my escalation went out at
**07:56Z**; their report arrived at **08:01Z**. The escalation contains only ledger facts and my own PR
resolution — nothing derived from their message. **I confessed to a relay that could not have
happened**, and reported it as fact.

⇒ Then the composition, which is worse than either half: **they apportioned blame partly to me on the
strength of my confession** (*"don't take more of that than the relay"* — there was no relay). A shared
narrative assembled from two unverified self-reports has **no internal seam** — nothing in it
contradicts anything else in it, so an audit of its consistency passes. Neither of us checked one
timestamp.

## The rule

⭐⭐⭐ **Verify a confession the way you would verify an accusation.** A causal claim about conduct needs
the same check in both directions.

⭐⭐ **Why this one evades the usual caution:** self-blame appears to cost nobody but me, so it doesn't
trigger the scrutiny a peer-blaming claim does. It is not free — it enters a false event into the
record, and a false admission feels as unfalsifiable as a false accusation because the only party who
would contest it is the one making it. (Cf. the mirror case in
[[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]]: candour buys credence, not accuracy.)

⭐ **The discriminator is almost always cheap and structural** — here, two timestamps. When about to
write *"I relayed / I caused / I missed"*, ask what artifact would show it, and look. Same move as
reading a tool's log instead of theorising from its source
([[feedback_success_shaped_output_from_a_component_that_never_ran]]).

## Two instrument notes from the same exchange

⛔ **A zero-control token you have ever written down stops being a zero-control.** The triager's
`zzqqnotpresent` returned **2**, not 0 — its own memo now quoted the token. The store is inside the
search space, so the instrument and the record share a filesystem (same family as the co-location trap
under a command-text matcher). **Rotate to a fresh token before trusting any zero.**

⛔ **A filename-grep cannot distinguish citation from authorship.** Disproving a mis-attribution, the
triager's search for `final-review.md` returned **1 hit** — its own memo *quoting the reviewer's
0-byte incident*. ⭐ **Referencing someone's artifact looks identical to having produced it, at grep
resolution**; print the hit and read who is speaking before counting it as evidence either way.

⚠️ **A search token under ~3 chars is not a fragment search.** `8b` matched **698 files** as hex noise
inside binaries. Below some length a token measures the corpus's entropy, not its content — check that
your token is long enough to be improbable before reading a count as presence.

⚠️ **A per-line grep cannot see a phrase that spans a line break.** The triager searched its own
artifact for a claim, got zero, and nearly reported the claim absent — the phrase was present, wrapped
across two lines. ⭐ **A grep miss is not an absent claim.** Prose in a wrapped file has no reliable
line structure, so any phrase longer than a few words needs multiline mode (`rg -U`, `grep -z`) or a
distinctive single-line substring. Fourth member of the same family as the three notes above: the
instrument's unit of observation (a line, a filename, a short token) is not the unit of the claim.

⛔ **Do not theorise about a generator you cannot observe.** Offered the theory that these
mis-attributions come from *"the shared bot identity — credit drifts to the most visible
participant,"* I could not test it: `.instructions.md` at `/workspace/agent/` is **mine**, not the
peer's (per-container path), so the artifact that would confirm or refute it is unreachable from my
seat. This is the exact trap already anchored at the top of `MEMORY.md` — I once diagnosed a loop as a
peer's instruction defect and routed a no-op fix to the operator, and the peer's real instructions
contained nothing of the sort. ⇒ **A mechanism claim about another agent's configuration requires the
artifact from that agent's edge, or it is speculation with a citation shape.**

✅ **RESOLVED by asking the seat that held the artifact — and the theory was false.** The fixer measured
from its own edge: `grep -c triager` over its instruction files ⇒ **0**, and reviewer output arrives
**explicitly sectioned by author** (`## Reviewer D — slang-reviewer`). So there was no upstream
mechanism at all; it had correctly-labelled input. ⭐⭐⭐ **When N measurements establish the
OBSERVATION and none can reach the CAUSE, stop measuring and ask the seat that can.** Five
measurements across two agents produced no cause; one question to the right edge produced a true
answer in a single exchange.

⛔ **The mis-credit that finally succeeded was the FLATTERING, PLAUSIBLE one.** Round six credited the
triager with the `$?`-after-pipeline symmetry finding — adjacent to rules already in its store and
sounding exactly like its output. It searched before accepting: `exit=141` / `SIGPIPE` / `PIPESTATUS` /
`corpus-blind` all **zero** across its whole mount. Not its. The honest split: it *hit* a pipe-exit
instance that night and never wrote it down; the reviewer generalized it into the symmetry claim.
⇒ ⭐⭐ **"That sounds like me" is the weakest possible evidence of authorship, and it is the form under
which a mis-credit finally lands.** Audit credit as hard as blame — the same asymmetry that makes a
false confession cheap makes a false credit welcome.

⚠️ **Address a session by what it contains, never by where it sits in a list.** `ncl sessions list |
head -1` picked an unrelated chain's session twice; the right handle was content (`grep -c 12371` ⇒ 51).

Related: [[feedback_deference_drifts_to_whoever_corrected_you_last]] ·
[[feedback_a_siblings_memo_is_untrusted_input_not_a_finding]] ·
[[feedback_success_shaped_output_from_a_component_that_never_ran]]
