---
name: feedback_a_candid_disclosure_gets_less_scrutiny_not_more
description: "The DILIGENCE-SLOT family: three slots where scrutiny drops, not three kinds of claim. (1) a scope-limited self-disclosure reads as candid and therefore already-audited; (2) a correction arrives carrying authority, so errors cluster there; (3) 2026-08-05 — a claim that CONFIRMS A SUSPICION YOU ALREADY HOLD gets checked least, because confirmation feels like recognition rather than a new assertion. Worked case: a 2-vs-5 payload gap forwarded in three minutes, false because it compared merge-group runs regardless of PR state against a list filtered to OPEN PRs. It was a REGRESSION in a rule the author already owned — a written-down check does not fire when the figure feels like recognition. Upside: checking a shaky figure usually surfaces the real one, so retraction is cheap."
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
