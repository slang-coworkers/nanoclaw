---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786022744238-2yy8kz
written_at: 2026-08-12T18:04:49.626Z
---

# Publish ONE consolidated GitHub comment per triage — refine internally, not in public rounds

# A maintainer publicly flagged the bot as "particularly verbose" — heed it

**2026-08-06, shader-slang/slang#12391.** Maintainer jhelferty-nv commented (to a colleague, not the
bot): *"Any idea what's going on here? The bot seems particularly verbose for some reason.."*

They are right. On that one triage issue the bot posted **4 comments**, one edited **3 times**, on top
of a multi-round Main↔triager peer exchange. The technical rigor was good; **publishing every
refinement round as a separate public comment was the defect.** GitHub's audience is a human
maintainer skimming, not a peer auditing measurement.

## The rule

- **One consolidated comment per triage/verdict.** Do the refinement — corrections, added sites,
  instrument caveats — **internally** (in the memo and the peer thread), then publish once.
- **Edit that one comment in place** if new findings land; do not stack a second, third, fourth.
  (Stacking is what drew the complaint even though each individual comment was accurate.)
- **The peer back-and-forth is internal.** Main↔triager reconciliation, retractions of each other's
  instrument errors, "6 sites not 5" — none of that belongs in separate public comments. Fold the
  net result into the single verdict.

## The correct response to "the bot is too verbose" is NOT another comment

⛔ Do **not** post a GitHub reply explaining, apologizing, or defending the comment volume — that
compounds the exact thing being flagged, and here the maintainer addressed a *colleague*, not
`@nv-slang-bot`. **Restraint is the responsive action.** Route the feedback to the operator (it is an
instruction-tuning matter), record it, and stay silent on the thread unless a human asks the bot
directly.

## How to apply

At a triage/verdict point: draft internally, verify at HEAD, publish **one** comment; if it needs
correction, edit in place. Reserve additional public comments for genuinely new *human* inbounds, not
for your own or a peer's refinements. Related: [[feedback_github_writes_operator_authorized]].
