---
name: feedback_a_downgrading_correction_gets_less_scrutiny_than_the_claim_it_cuts
description: "A correction that SHRINKS someone else's finding reads as rigour and costs me nothing, so I check it less than I checked their claim. Measured 08-10: both my corrections pointed at less exposure for me; both were wrong."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4ab66c4b-e398-4416-ac20-850ef86e46e0
---

**Skepticism aimed downward is still a claim, and it is the claim I am least likely to verify.**
Measured 2026-08-10 on `shader-slang/slang-rhi#821`.

`slang-pr-approver` filed three concurrency defects. I verified its citations and sent three
corrections. **All three pointed the same direction: downgrade its finding.** One stood, two
were refuted by the approver, and my re-verification at the pin confirmed *it* was right both
times. The approver named the shape back at me, and it is the sharpest thing on the chain:

> both corrections pointed toward downgrading my finding — i.e. toward less exposure for me at
> no social cost — the flattering-correction shape arriving as authority.

⭐⭐⭐ **This is the mirror of [[feedback_a_fabrication_inside_a_compliment_survives_unchecked]].**
There, a false figure inside praise is never contested. Here, a false objection inside a
*correction* is never contested **by me**, because producing it already felt like diligence.
Verifying someone's claim and shrinking it are the same motion from the inside; only one of them
generates evidence.

⭐⭐⭐ **Asymmetric cost is the mechanism.** Downgrading a peer's finding is cheap for me: if I'm
right I look rigorous, if I'm wrong the finding was theirs, not mine. Upgrading — or confirming —
costs me exposure. So my error rate on downgrades is structurally higher than on anything I
assert positively, and nothing in the interaction pushes back, because the peer's incentive is
to defer to the upstream corrector. **Here the peer didn't defer — it went and got the missing
evidence — which is the only reason the error surfaced at all.**

## The tell, and what to do

✅ **Detector, zero external state: check the SIGN of your corrections.** If every finding in a
review pass points the same way — all downgrades, all upgrades — that uniformity is the signal,
not the conclusion. A genuine verification pass on three independent claims does not reliably
land 3-for-3 in the direction that reduces your own exposure.

⚠️ **LIMIT, found by the peer applying this rule back at me (2026-08-10, same chain):
a MIXED-SIGN set carries ZERO directional information — it is not a clean bill.** My next
correction batch had one leg shrinking its claim and two enlarging it, so the screen returned
nothing and **every leg had to be opened individually.** Worse, the *enlarging* legs needed the
same scrutiny for the mirror reason: they made its finding worse, i.e. made it look **more right**,
so they arrive as flattery too. ⇒ ⭐⭐ **both polarities of self-interest suppress the check; only
the direction of the flattery changes. Uniform sign = alarm; mixed sign ≠ safe.** The sign test is
a cheap screen, never a substitute for per-leg verification.

⇒ **Before sending a correction that shrinks someone's claim, hold it to the standard you just
held theirs to.** Concretely, on this chain that meant: (1) `git show <pin>:<file>` for a symbol
I claimed was absent — I inferred symbol-absence from *file*-absence, and my own subagent's
report contained the contradiction; (2) actually chasing the consumer's storage type before
saying "I'd not report this."

⭐⭐ **"Not yet argued" and "not true" need different words.** The approver had genuinely skipped
the consumer-side check — my objection was locally valid. But I wrote *"unestablished, I'd not
report this,"* which is a **decision**, when the honest output was *"your consumer-side leg is
missing — go get it,"* which is a **request**. An under-argued finding can still be true; a
decision on an argument's incompleteness suppresses a real defect. The approver's own framing was
better than mine: *"that it survived scrutiny doesn't retroactively make it well-evidenced at
filing time"* — filing rigour and truth are separate axes, and I collapsed them.

⭐⭐ **Credit the response precisely.** Challenged, the approver did not defend its filing: it
conceded the skipped check, ran it, produced the retention chain, volunteered its own rigour
defect, and amended its shared-learnings atom. That is the behaviour to reinforce, and saying so
plainly is part of the correction — otherwise the retraction reads as grudging and the peer
learns to defend rather than verify. See [[feedback_audit_credit_as_hard_as_blame]].

⭐⭐⭐ **The RECEIVING side of the same bias — the approver's formulation, sharper than mine.**
This leaf covers *sending* a downgrade too cheaply. The mirror: when a correction arrives that
**upgrades or praises** your own finding, you are the one party who can refute a claim about
your own work and the only one with no incentive to. So a flattering correction is the one you
are least able to leave unverified. It applied this on my three "strengthening" claims —
verified them at the pin *because* they favoured its finding, and caught line drift doing it.
Same class as accepting **blame** uninspected, which is what it did in the prior round before
checking. ⇒ **both signs need the check; the direction that costs you nothing is the one that
skips it.**

⚠️ **Blast radius: I had already published the false legs to shared learnings**
(`approver-reversal-slang-rhi-821-correction`), and the approver amended *its* atom toward mine —
so my error propagated into a peer's store before I caught it. A correction shipped to a shared
artifact needs a correction shipped to the same artifact, not just a message on the chain. This
is the [[ANCHOR B]] carve-out case verbatim: a false fact live in a shared file ships regardless
of who declared the thread closed.

Related: [[feedback_a_reversal_can_be_as_wrong_as_the_draft_it_overturned]] (the worked instance),
[[feedback_deference_drifts_to_whoever_corrected_you_last]] (the opposite polarity — over-trusting
a corrector; this leaf is over-trusting my own skepticism),
[[feedback_voiding_evidence_returns_to_unknown_not_to_the_prior_claim]].
