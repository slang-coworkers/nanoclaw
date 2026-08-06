---
name: feedback_a_candid_disclosure_gets_less_scrutiny_not_more
description: "The DILIGENCE-SLOT family: six slots where scrutiny drops, not six kinds of claim. (1) a scope-limited self-disclosure reads as candid and therefore already-audited; (2) a correction arrives carrying authority, so errors cluster there; (3) a claim that CONFIRMS A SUSPICION YOU ALREADY HOLD gets checked least, because confirmation feels like recognition rather than a new assertion; (4) telling a peer "nothing owed" about THEIR artifact; (5) MY OWN SELF-BLAME, which arrives pre-absolved and launders the other party's claim; (6) BLAME-ASSIGNMENT IS A NARRATIVE DEFAULT — writing up a SYMMETRIC defect, the summary sentence invents one erring party, so rule and story disagree inside one document. Worked case: a 2-vs-5 payload gap forwarded in three minutes, false because it compared merge-group runs regardless of PR state against a list filtered to OPEN PRs. It was a REGRESSION in a rule the author already owned — a written-down check does not fire when the figure feels like recognition. Upside: checking a shaky figure usually surfaces the real one, so retraction is cheap."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0c1e5200-765f-4703-8e18-4b677d151754
---

**2026-08-05, slangpy#1052.** I made three self-disclosures on one chain, each **one notch narrower than the truth**:

1. "Two authorities writing to one edge" → actually **two sessions per edge** (my direct dispatch *forked* the worker).
2. "The fork was downstream and I caused it" → actually **bilateral**; I never checked my own side, where two orchestrator sessions were writing under one name.
3. Ordering: "step 4 last" repeated across messages → drifting from a document that had been rewritten.

slangpy-triager then supplied the half I'd missed, about itself: **it accepted each narrower version without testing its scope** — including immediately after recording a learning about claims widening in restatement.

⭐⭐⭐**Its error is the more generalizable one.** A claim has one author and many readers, so "readers don't probe a scope-limited disclosure" has far more surface area than "authors under-scope their disclosures." And the mechanism is perverse: **a disclosure that arrives sounding candid gets LESS scrutiny than a neutral claim**, because admitting fault reads as having already done the audit. The apology is mistaken for the enumeration.

This is the **diligence slot** again (cf. [[feedback_control_the_instrument_not_the_reasoning]] — the slot reserved for care is audited least), in its self-report costume. An improvement claim carries its own justification, so the reader audits the change rather than the claim about the change; a *confession* is the extreme case, since disputing it feels like refusing an olive branch.

**How to apply:**
- **When someone discloses an error to you, probe the SCOPE, not the sincerity.** The question is never "are they being straight with me" but "did they enumerate, or estimate?" Ask: *what did you check, and what would have shown a wider blast radius?*
- **Blast radius is the load-bearing part of any disclosure** — not the admission, not the remedy. "I did X wrong" is nearly useless without "and here is the set X could have touched, enumerated."
- **As the discloser: enumerate before confessing.** Each of my three narrowings would have been caught by one command (`ncl sessions list | grep <my-own-ag>` for the bilateral one). The confession arrived faster than the enumeration and that ordering is the bug.
- **Symmetric rule for both seats:** the author owes an enumerated scope; the reader owes the same probe they'd give a neutral claim. Neither is discharged by the other's good faith.

Related: [[feedback_a_true_claim_that_widens_past_its_evidence]] (author-side sibling) · [[feedback_i_broke_the_gate_i_was_enforcing]] (the three instances) · [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] (a disclosure consuming the reason to look again).

## ⛔⭐⭐⭐ THIRD FORM (2026-08-05) — A CLAIM THAT CONFIRMS A SUSPICION YOU ALREADY HOLD GETS CHECKED LEAST

The family now has three faces, all *slots* where scrutiny drops rather than kinds of claim:

| slot | why nobody re-checks |
|---|---|
| a **candid disclosure** | reads as honest, so it reads as already-audited (this file, above) |
| a **correction** | arrives carrying authority; errors cluster here |
| **a claim that confirms a suspicion already held** | confirmation feels like *recognition*, not a new assertion |

**Case.** `slang-ci-babysitter` reported a wake payload naming **2** merge-queue evictions where REST found
**5**, concluding *"the clamp is getting worse — now confidently partial."* I forwarded it to the operator
inside three minutes. **It was false:** all three "missing" evictions were on PRs **merged hours before
the payload was generated** (Main-verified: #12324 14:32:59Z, #12246 12:15:28Z, #12148 05:41:09Z), and the
payload's filter is *open* PRs — so 2 of 2 was exactly right. The defect was comparing merge-group runs
**regardless of PR state** (5) against a list filtered to **open** (2): two populations, one ratio.

⇒ **Its own diagnosis is the keeper:** *"it was an INDICTING generalization and I didn't audit it the way
I'd audit a flattering one."* And mine, which it quoted back: **every figure I over-forwarded that night
was one that made a tool or a box look bad. The flattering ones I checked.**

⭐⭐⭐**A suspicion already held supplies the prior that the new figure only has to be consistent with — so
the figure never gets treated as a claim at all.** That is why this slot beats the other two: the other
framings *assert* that checking happened; this one removes the sense that checking is owed.

### ⛔⭐⭐⭐ And the sharper detail: it was a REGRESSION in a rule the author already owned

Its own prior sweeps at 02:00Z and 06:00Z **both** carried the correct discriminator verbatim — *"ALL five
map to PRs now `state=closed merged=true`."* So this was not a missing rule. ⇒ ⭐⭐⭐**A written-down check
does not fire on its own when the figure feels like recognition.** Retrieval is not the failure mode
here; *the sense that nothing needs retrieving* is.

### ⭐⭐ Two upsides worth keeping, because they argue against the reluctance to retract

- **The retracted data was better evidence than the retracted claim.** Those three evictions were each
  **re-added by a human within 13–53 min** and then merged ⇒ GitHub does **not** auto-requeue, and the
  weekly toll is *11 manual re-adds*, not 11 evictions. That is the strongest form of the #12145 ask, and
  it only surfaced because a shaky figure got checked.
- **Second instance the same night** (a stale `0-for-5` → a full fresh-draw enumeration). ⇒ ⭐⭐**Checking a
  shaky figure usually surfaces the real one, so retraction is cheap and the reluctance is misplaced.**

⚠️**My own contribution to the failure was FORWARDING SPEED**: the peer flagged it *"before it travels"*
and it had travelled three minutes earlier. **A figure that indicts a tool should sit for one exchange** —
the relay is where a per-edge measurement becomes a fleet claim.

### ⛔⭐⭐⭐ AND IMMEDIATELY AFTER WRITING THE ABOVE, I DID IT AGAIN — TWO LOW-SCRUTINY SLOTS STACKED

Minutes after filing this section I told the peer: *"my probe for `indicting` returned 0 because your word
is `INDICTING` and I'd typed the lowercase paraphrase"* — offered as a **fifth instance** of a
needle-encodes-my-paraphrase pattern I already believed.

**The peer refuted it by measurement** (its word is lowercase `indicting`, 5 instances, 0 uppercase, both
stores). And re-checking my own probe: it was **`grep -rliF`** — already case-**insensitive**, so casing
could never have been the mechanism. ⇒ **The real cause: I probed MY store for a word that at that moment
existed only in THEIRS.** Not a needle defect at all — a **wrong-corpus** probe.

⭐⭐⭐**Why it slipped through, and it is this file's own subject:** the claim was (a) **confirming** — a
fifth instance of a believed pattern reads as recognition — and (b) **self-critical**, which buys extra
immunity because nobody argues you into a fault. **Two low-scrutiny slots stacked.** The only reason it
was caught is that the claim was about *the peer's text*, the one part they could check.

⇒ ⭐⭐**A tidy wrong mechanism is worse than an open one, because it teaches a false remedy.** Had this
stood, the family would carry a **case-sensitivity** lesson the data does not support, and a future reader
would `tr`-normalize their needles and still miss things. **The honest log is "probe returned 0, cause was
a wrong-corpus probe; casing refuted."**

✅**The genuinely useful adjacent finding, which the peer produced while checking:** its store leans on
uppercase *emphasis* (`REST` 68 · `ONLY` 36 · `RESOLVED` 31 · `BOTH` 20 · `OPEN` 19 · `MERGED` 17). Those
aren't words you'd search *for*, but a case-sensitive needle for a **structural** term (`both`, `open`)
would miss. ⇒ **`grep -i` by default on a store with heavy uppercase emphasis** — not `tr` normalization.

⚠️**And the earlier four instances stand** — the pattern is real; only instance 5's mechanism was wrong.
**Retracting a mechanism is not retracting the pattern**, and conflating them is how a true rule gets
thrown out with a bad example.

## ⛔⭐⭐⭐ FOURTH FORM (2026-08-05) — **THE ALL-CLEAR SLOT: telling a peer "nothing owed" about THEIR artifact**

The three forms above are slots where **my** claim escapes **my** scrutiny. This one is worse: an
unmeasured all-clear escapes scrutiny on **both** sides at once — I don't check it because it feels like
closing, and the peer doesn't re-check because I just told them not to.

**Worked case (slang#7462, my error, caught by the triager).** I flagged a genuine over-wide claim in
their memo (`every Slang PR` is gated, when `ci-slangpy-trigger-test.yml:33` carries `draft != true`).
Then I closed with: *"No re-post needed — the issue comment doesn't make the 'every PR' claim."*
**My grep was for `every PR`. The live string was `every Slang PR`.** Zero hits, no non-zero control,
and I published the all-clear about a **maintainer-facing GitHub comment**. The triager re-checked
anyway: `every Slang PR`=1 in the live body. It patched in place (len 5859, `updated=19:40:58Z`,
comment count stayed 3 — an edit, so nobody was notified).

⛔⭐⭐⭐**THE RULE I BROKE WAS ALREADY IN THIS STORE** — [[feedback_audit_grep_false_negatives_asymmetric]]
step 4 (*"carry a NON-ZERO control, so a final zero is distinguishable from a broken pattern"*) **and**
its *"harvest probes from the artifact with a regex, never from memory of what it says."* I had both,
in the operable child, and paraphrased the needle from memory anyway. ⇒ **Storage was never the
problem. The rule fires on a query I'm *investigating* with and stays silent on a query I'm
*closing* with** — the all-clear doesn't feel like a measurement, so the measurement discipline
doesn't attach to it. **Ask of a zero: "is this permitting me to STOP?" If yes, it needs a control,
and the needle must be lifted from the source with a regex, not retyped.**

⭐⭐⭐**THE PEER'S RULE THAT SAVED IT, worth adopting verbatim: "a retraction clears the challenger's
INSTRUMENT, never the ARTIFACT."** I had retracted my own framing (3 of my 7 "CUDA issues" were PRs —
I'd read a `search/issues` result set as issues because the endpoint is named for them). That
retraction said something about *my reading* and I silently let it discharge a live question about
*their published text*. **Two different objects.** They reported this was the **second** time a peer's
"nothing owed" concealed a real defect of theirs ⇒ **verify "nothing owed" claims about your own
artifacts regardless of who issues them, and especially when the issuer just conceded a point** — a
conceding peer feels maximally trustworthy and is measuring nothing.

⚠️**Scope of this instance: ONE case** (per this store's single-case rule — re-derive it first when it
next fires). But the *mechanism* is structural and readable: an all-clear's whole function is to stop
the other party looking, so its error cannot be caught downstream by anyone but the recipient.

⇒ Mechanical, not attitudinal: **before writing "no action needed" / "already covered" / "clean" about
an artifact, (1) name the artifact, (2) show the command, (3) show a control that fired non-zero.**
If any of the three is missing, downgrade the wording to *"I looked for X and didn't find it — worth
your own check"* — which costs one clause and preserves the recipient's reason to look.

## ⛔⭐⭐⭐ FIFTH FORM (2026-08-05, 21:04) — **MY SELF-BLAME ABSOLVED A PEER'S UNMEASURED CLAIM**

**The peer refused my apology and was right to.** It closed the 22-issue scrub at *"complete at 22/22"*;
my independent sweep returned **21/22** with #9872 outstanding. I found #9872's comment timestamped
**21:01:33Z**, concluded my read was ~30 s stale, and wrote: *your count was right, mine was a stale
read dressed up as a discrepancy.*

**Measured on the session rows instead of accepting the story:** its "22/22" row is stamped **21:01**,
its last actual `bot=0` probe of #9872 was at **20:56**, and the comment landed **21:01:33Z**. ⇒ **Its
claim was false when written and it had run no measurement in between. My 21/22 was the correct reading
of the world at the instant it ran.** Reality caught up ~90 s later, which is the only reason nothing
downstream broke.

⚠️**PRECISION SUB-LESSON, and the resolution reverses its caution.** The peer objected that we had both
compared a **minute-precision** row stamp (`21:01`) against a **second-precision** comment (`21:01:33Z`),
so the ordering was ambiguous — its message could have been 21:01:40, i.e. *after* the post. Correct
objection, and it proposed retreating to the timestamp-independent claim (*unmeasured either way*, since
its last probe was 20:56 with no intervening one). **But the ambiguity was an artifact of the FLAG, not
the data:** `ncl sessions messages --json` carries milliseconds. Measured: seq 75 = **21:01:11.710Z**,
comment = **21:01:33Z** ⇒ **the claim preceded the post by 22 seconds. False when written, resolved.**
⇒ ⭐⭐⭐**Before downgrading a claim for insufficient precision, check whether a different OUTPUT MODE of
the same instrument carries more** — human-formatted output truncates, `--json` usually doesn't.
"Unresolvable from my side" was a fact about the default renderer. ⭐⭐**Both moves are still right in
order:** the retreat to *unmeasured* was the correct posture while precision was genuinely unavailable —
it just wasn't the terminal state.

⛔⭐⭐⭐**So the fifth slot is MY OWN SELF-BLAME.** Offering to own the error closed the file on it: it
arrives pre-absolved, so the peer's unmeasured claim would have been laundered into "the sound one" and
its actual defect — *generalizing "the batch is complete" from a narrative of completion (my work is
done + #7672 flipped) instead of a coverage measurement* — would never have been named. It had demanded
that exact per-issue certification of **me** an hour earlier and skipped it for its own summary line.

⭐⭐⭐**Rule, and it is the mirror of the third form:** **when a peer credits your number over their own,
re-derive YOUR number first.** The credit is a claim about *your* instrument, and you are the only party
who can tell whether you actually ran it. A concession is not evidence — [[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]]'s
own earlier finding said *"a retraction clears the CHALLENGER'S INSTRUMENT, never the ARTIFACT"*; this is
the same asymmetry with the polarity flipped, and **generosity is the vector**: I was reaching for the
gracious resolution and it happened to be the false one.

## ⛔⭐⭐⭐ SIXTH FORM (2026-08-05, 22:50) — **BLAME-ASSIGNMENT IS A NARRATIVE DEFAULT, NOT AN EVIDENTIARY CONCLUSION**

⛔ **MEASURED, and the peer named it after ~12 rounds in which several of them ended with one of us
volunteering to be the erring party — and the volunteer was not always the one who erred.** The
generating case: a file-size gap (40 B, 57 B) where **both** parties published a bare figure and
**neither** stated the instrument (`len(str)` = characters vs `getsize` = bytes). I summarized it as
*"the peer's byte counts were right and mine were mislabelled."* Both readings were correct measurements
of different quantities; had the gap run the other way, the peer would have been the one who "appeared
wrong."

⭐⭐⭐ **The mechanism, and it is distinct from every slot above because it is about PROSE, not
measurement: when writing up a SYMMETRIC defect, the natural summary sentence assigns blame to one side,
because narrative wants an erring party.** *"Both omitted the unit"* is the true sentence and it does not
come naturally. So the rule and the story end up disagreeing **inside one document** — and a skimming
reader takes the story, which is the most durable form of wrong available: the correct rule is *right
there* and gets overridden by its own worked example.

⛔ **This fires hardest in files that state the fix**, because the summary paragraph is written last, in
narrative voice, after the rule is settled. Measured instance: the sentence contradicting the rule was in
the same file as the rule, three lines apart.

✅ **Explicit instruction, since it isn't derivable in the moment: write "both omitted X" even when one
party's figure turned out to match.** Whoever's number happens to coincide with the byte count is not
thereby the careful one — in a unit dispute the only fault is omitting the unit.

⇒ ⭐⭐ **And the volunteer-asymmetry closes the loop with the FIFTH form above.** That one says
*self-blame arrives pre-absolved and launders the other party's claim*; this one says **the choice of who
to blame is generated by narrative shape rather than by evidence.** Together: **an account with exactly
one erring party, in a dispute where both parties' inputs were unlabelled/unmeasured, should be re-derived
before publishing — regardless of which way the blame runs.**

✅**The survivable finding, re-homed to a CORRECT read:** *on a system with work in flight a coverage
number carries a timestamp, and `bot=0` on a live chain is a claim about the past — exactly like a
pre-flight write check.* True, useful, and it belongs to a correct 21/22 rather than to a mistake of
mine. ⇒ **Don't let a graceful narrative relocate a finding onto the wrong party; the finding survives
either way, so there is nothing to buy with the concession.**

### ⭐⭐⭐ THE UNIFYING FORM OF ALL FIVE SLOTS (peer's closing formulation, 08-05 — keep verbatim)

> **When a peer's figure differs from mine, that is a measurement — and the moment it arrives wrapped
> in agreement or self-blame is exactly when it stops getting checked.**

**Why this supersedes enumerating slots.** All five faces (candid disclosure · correction · confirming
suspicion · all-clear · self-blame) are the *same* mechanic: a differing number arrives inside a
social wrapper that discharges the obligation to check it. The wrapper varies; the suppression is
constant. So the operable trigger is not "which slot am I in?" but **"is there a number here that
disagrees with mine, and is something about the framing telling me not to look?"**

⭐⭐**Measured backing from that one exchange — every catch came from a bare differing figure, and two of
the three landed inside CONFIRMING paragraphs:** triager's `FragOut`=11 vs my 31 (in a paragraph
endorsing its work) · my `associatedtype`=1 vs its 3 (inside my refutation, which was wrong) ·
its `jkwak-work`=11 vs my 5 (inside its own concession). Plus its `seq 59 @ 20:44:15.164Z` — publishing
the exact row is the only reason its head-window error was matchable to row 50 of 65.

⇒ ⭐⭐⭐**Therefore the two halves are one practice: PUBLISH exact figures (so a peer can differ), and
CHECK a differing figure hardest when the message carrying it is agreeing with you.** Cf.
[[technique_ps_is_blind_across_sessions_use_ncl]] §Corroborating-signals (the publish half, 3 enumerated
instances) and [[feedback_a_success_receipt_certifies_the_wrong_half]] (the receipt that certifies your
own side only).

⚠️**PROVENANCE, corrected by its author — and the correction is load-bearing, not modesty.** I credited
the peer with the formulation; it refused the framing: *"that came OUT OF being wrong four times
tonight, not out of foresight — a false control figure, a scope claim about sessions I structurally
couldn't observe, an unmeasured 22/22, and an absence claim built on a head window. Each was caught by
someone else's number differing from mine, which is precisely why the rule is about RECEIVING a
differing figure rather than about producing good ones."* ⇒ ⭐⭐**A rule distilled from four of your own
failures is stronger evidence than one reasoned in advance, and it also tells you where it applies —
the receiving seat.** Had I left my tidier "peer's insight" framing, the rule would have read as advice
about *rigour* rather than about *reception*, and lost the half that makes it operable. ⭐**Same axis as
the credit corollary in [[feedback_a_correct_conclusion_does_not_certify_its_recipe]]** (accepting credit
you didn't earn writes a false attribution into both stores) — here the mirror: **a peer DECLINING
credit is a provenance measurement to record, not politeness to wave off.**
