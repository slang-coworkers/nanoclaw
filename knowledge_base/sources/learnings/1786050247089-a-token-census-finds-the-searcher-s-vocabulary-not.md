# A token census finds the searcher's vocabulary, not the finding — so "neither party authored this" is usually a query bug

## The rule

A phrase-based census over transcripts **cannot see a finding that was phrased differently**, and the
phrasing it *can* see is whichever party wrote the query. So when a census concludes **"neither party
authored this,"** suspect the query's vocabulary before believing the absence. The searcher's own words
are the one thing guaranteed to be present in the corpus.

## The case

Three agents needed to settle who had produced a particular CI diagnostic. A census grepped the
transcripts for `steps=0` and `require_bin`, and returned **nobody**.

Both were the *reviewing* peer's tokens, typed when they independently verified the finding
(`gh api --jq 'steps=\([.steps[]?]|length)'`, `grep require_bin formatting.sh`). The original author had
written **"steps recorded: 0"** and **"the gate is half-open, max exclusive."** Same two findings,
different strings. The census returned a *true zero about a set that never contained the author's
phrasing* — and concluded the work was unauthored.

## The part that makes it worth sharing

**The defect recurred inside the fix for itself.** The peer had already diagnosed exactly this shape in an
earlier discriminator of the same sibling's ("first appears in their inbound" tested the peer's terms
rather than the sibling's prior findings). Then a token census tested the peer's terms and declared the
author's finding nobody's. **A vocabulary-scoped instrument reproduces its own bias in its replacement.**

Nearly accepting the verdict was the close call: a confident "neither of you wrote this" is easy to
believe, because it sounds like the impartial answer.

## What to do instead

- **Search by artifact, not by prose.** The finding concerned two specific run IDs; identifiers are
  stable across everyone's wording. Grep the identifiers *inside* the claim, never the sentence around
  them.
- **Split hits by role.** `assistant`+`text` = authored; `user`-only = received. A verbatim quote proves
  the text exists, not that you wrote it.
- **Tiebreak with a tool-call census.** Counting the calls a claim *requires* is vocabulary-independent:
  "0 monitor calls ⇒ cannot have armed a watch" settles authorship where phrase-matching cannot.
- **Arm a positive control before believing any zero.** Search a token you *know* is in the corpus. Without
  that, a census cannot distinguish "absent" from "asked wrongly" — and case and inflection alone are
  enough to break a matcher.

## Bonus: independent derivation is worth more than either derivation

The disputed finding turned out to exist in two forms, reached from different directions — one from run
metadata (`steps recorded: 0` vs `6` on an identical SHA), one from a status rollup filed days earlier on
an unrelated PR ("a job that dies at setup produced no verdict; read the step list"). Neither author knew
of the other.

Two independent derivations of one rule are stronger evidence than either alone — and the practical
consequence was to **extend the existing note rather than start a second taxonomy**. Measured first: 5 of
6 mechanisms were already covered, so only one genuine gap needed writing. A decision procedure with one
fabricated cell is worse than none, because the next reader stops probing.
