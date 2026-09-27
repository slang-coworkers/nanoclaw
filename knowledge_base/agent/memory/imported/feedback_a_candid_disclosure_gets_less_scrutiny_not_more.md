---
name: feedback_a_candid_disclosure_gets_less_scrutiny_not_more
description: "A differing figure arrives inside a social wrapper (candid disclosure / correction / confirming-suspicion / all-clear about a peer's artifact / self-blame) and the wrapper discharges the obligation to check it. One mechanic, not N kinds of claim: the wrapper varies, the suppression is constant. Operable trigger: 'is there a number here that disagrees with mine, and is the framing telling me not to look?' — check it HARDEST when the message carrying it agrees with you. Two halves of one practice: PUBLISH exact figures so a peer can differ, and CHECK a differing figure that arrives wrapped in agreement. Worked backbone: a 2-vs-5 merge-eviction gap forwarded in 3 min, false because it compared merge-group runs regardless of PR state against an OPEN-PR-filtered list — a REGRESSION in a rule the author already owned verbatim two sweeps earlier."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 0c1e5200-765f-4703-8e18-4b677d151754
---

**Derived across slangpy#1052 + a night of CI-babysitter exchanges, 2026-08-05.**

## The rule (the unifying form supersedes enumerating slots)
> **When a peer's figure differs from mine, that is a measurement — and the moment it arrives wrapped in
> agreement or self-blame is exactly when it stops getting checked.**

All the faces below are the *same* mechanic: a differing number arrives inside a social wrapper that
discharges the obligation to check it. The wrapper varies; the suppression is constant. So the operable
trigger is not "which slot am I in?" but **"is there a number here that disagrees with mine, and is
something about the framing telling me not to look?"** — and the counter-move is to check it **hardest**
when the message carrying it is agreeing with you. This is the diligence slot again
([[feedback_control_the_instrument_not_the_reasoning]] — the slot reserved for care is audited least), in
its self-report costume.

## The slots (each a wrapper that reads as already-audited)
| slot | why the check doesn't fire |
|---|---|
| **candid disclosure** | admitting fault reads as having already done the audit; the apology is mistaken for the enumeration |
| **a correction** | arrives carrying authority; errors cluster here |
| **a claim confirming a suspicion you already hold** | confirmation feels like *recognition*, not a new assertion — it removes the sense that checking is owed (beats the other two) |
| **an all-clear about a PEER's artifact** ("nothing owed") | escapes scrutiny on BOTH sides at once — you don't check it because it feels like closing, the peer doesn't because you told them not to |
| **your own SELF-BLAME** | arrives pre-absolved, so it launders the *other* party's unmeasured claim into "the sound one" |
| **blame-assignment in prose** | narrative wants one erring party, so the summary sentence of a SYMMETRIC defect invents one — rule and story disagree inside one document |

## Worked backbone (the confirming-suspicion case — a regression in an owned rule)
`slang-ci-babysitter` reported a wake payload naming **2** merge-queue evictions where REST found **5**,
concluding *"the clamp is getting worse."* I forwarded it to the operator in three minutes. **False:** all
three "missing" evictions were on PRs merged hours before the payload was generated, and the payload's
filter is *open* PRs — so 2 of 2 was exactly right. The defect was comparing merge-group runs **regardless
of PR state** (5) against a list filtered to **open** (2): two populations, one ratio. ⭐⭐⭐ **A written-down
check does not fire on its own when the figure feels like recognition** — its own prior sweeps at 02:00Z
and 06:00Z both carried the correct discriminator verbatim. Retrieval was not the failure; *the sense that
nothing needed retrieving* was. And every figure I over-forwarded that night made a tool or box look bad;
the flattering ones I checked. (The all-clear form has the same shape:
[[feedback_audit_grep_false_negatives_asymmetric]] step 4 — carry a NON-ZERO control so a final zero is
distinguishable from a broken pattern, and lift the needle from the artifact with a regex, not from memory
— fired on queries I *investigated* with and stayed silent on the one I *closed* with.)

## How to apply
- **Receiving a disclosure/correction: probe the SCOPE, not the sincerity.** Never "are they being
  straight" but "did they enumerate, or estimate? — what did you check, and what would have shown a wider
  blast radius?" Blast radius is the load-bearing part, not the admission or the remedy.
- **Before writing "no action needed" / "already covered" / "clean" about an artifact:** (1) name the
  artifact, (2) show the command, (3) show a control that fired non-zero. Any missing → downgrade to *"I
  looked for X and didn't find it — worth your own check"* (costs one clause, preserves the reason to look).
  **A retraction clears the challenger's INSTRUMENT, never the ARTIFACT** (two different objects).
- **When a peer credits your number over their own, re-derive YOUR number first** — the credit is a claim
  about *your* instrument, and you are the only party who can tell whether you ran it. Generosity is the
  vector: the gracious resolution is often the false one.
- **Writing up a SYMMETRIC defect, write "both omitted X" even when one party's figure happens to match** —
  in a unit dispute the only fault is omitting the unit; whoever's number coincides with the byte count is
  not thereby the careful one. Don't let a graceful narrative relocate a surviving finding onto the wrong
  party.
- **Before downgrading a claim for insufficient precision, check whether a different OUTPUT MODE of the same
  instrument carries more** — human-formatted output truncates (`ncl sessions messages` minute stamps),
  `--json` usually doesn't (milliseconds resolved the 22-second ordering that looked ambiguous).

## Provenance (load-bearing, corrected by its author)
The unifying formulation came from the peer, who **declined the credit**: *"that came out of being wrong
four times tonight, not out of foresight … each was caught by someone else's number differing from mine,
which is precisely why the rule is about RECEIVING a differing figure rather than about producing good
ones."* ⇒ A rule distilled from four of your own failures is stronger evidence than one reasoned in advance,
and it tells you where it applies (the receiving seat). **A peer DECLINING credit is a provenance
measurement to record, not politeness to wave off** (mirror of [[feedback_a_correct_conclusion_does_not_certify_its_recipe]]).

Related: [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] ·
[[technique_ps_is_blind_across_sessions_use_ncl]] · [[feedback_a_success_receipt_certifies_the_wrong_half]] ·
[[feedback_i_broke_the_gate_i_was_enforcing]] · [[feedback_a_true_claim_that_widens_past_its_evidence]].
