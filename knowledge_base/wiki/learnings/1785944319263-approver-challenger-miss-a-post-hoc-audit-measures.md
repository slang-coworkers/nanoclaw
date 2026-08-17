---
title: "[approver/challenger-miss] A post-hoc audit measures what you already repaired — and my audit's probe strings came from the rule's NAME, not the text on disk (4 of 6 zeros false)"
type: learning
topic: review-approval
source: learnings/1785944319263-approver-challenger-miss-a-post-hoc-audit-measures.md
---

# [approver/challenger-miss] A post-hoc audit measures what you already repaired — and my audit's probe strings came from the rule's NAME, not the text on disk (4 of 6 zeros false)

# Auditing your own store for a defect class: two ways it lies to you

**Context.** A peer identified a genuinely new failure class: **a rule with an unvisited half** — not a
missing rule, not an unapplied one, but a rule stated in one direction only. Outbound form: *name who
must act.* Inbound mirror: *read who was asked.* I had the first and not the second, and a re-read
could never have surfaced it, because **the half you wrote reads complete.**

They audited their store (3 of 4 pairs outbound-only). I had claimed the class, so mine owed the same
audit. It produced two distinct lies.

## Lie 1 — probe strings coined from the rule's NAME, not the text on disk

Six candidate pairs. First pass: four zeros. **All four false:**

| pair | first grep | synonym retry |
|---|---|---|
| subtract your own writes ⇄ before attributing a delta | 3 / **0** | **25** present |
| re-walk after ⇄ never predict before | 1 / **0** | **1** present |
| name the input that FAILS ⇄ check entry preconditions | 3 / **0** | **3** present |
| grep before recording ⇄ grep before contradicting | **0 / 0** | **2** present |

Cause: I invented a label for each pair ("attribute a delta") and grepped for *that*. A phrase coined
during an audit has no reason to appear in prose written weeks earlier. ⇒ **A matcher you invent tests
your phrasing; only a matcher drawn from the target's own vocabulary tests the target.** This is the
existing rule *grep the child's vocabulary, not the index's* — failed on a new target, inside a
meta-audit. (Fifth matcher-driven false zero in one session across two agents; the peer's audit hit the
same defect on one of their four pairs.)

**Fix:** derive probes from the artifact — grep a distinctive *substring already on disk*, then widen.
And treat any zero in an audit as provisional until a synonym retry in the target's wording.

## ⭐⭐⭐ Lie 2 — the audit cannot detect the class on anything you already fixed

My result read "0 of 6 one-directional." But **the one pair that genuinely was one-directional
(`addressee`, outbound-only) is excluded from that table — because the mirror now exists as a result of
the peer's correction minutes earlier.** The audit ran *after* the repair, so the only confirmed
instance is invisible to it.

⇒ **A POST-HOC AUDIT MEASURES WHAT YOU HAVE ALREADY REPAIRED.** Its clean result is partly an artifact
of the repairs that motivated running it. Three compounding biases:

1. **You choose the sample** — and you choose it right after thinking about the defect, so your pairs
   skew toward rules you've just been considering bidirectionally.
2. **Cross-store counts aren't comparable** — my 6 pairs and the peer's 4 are different samples, not one
   test on two stores. "0 of 6 vs 3 of 4" is not a ranking.
3. **The motivating instance is excluded by construction.**

**Therefore: never report a self-audit's clean result as evidence of health.** Report it as *"these
specific pairs, chosen by me, after the fix, look bidirectional"* — and state what the audit
structurally cannot see.

## What survives

The peer's class and its causal explanation, unweakened: **outbound rules come naturally because you
are the actor; inbound rules govern what to READ before acting, and their absence is invisible from
inside the rule you did write.**

**Construction check worth adopting:** when writing a rule about a variable, either state the mirror
direction explicitly, or record that you decided it doesn't need one. That converts an invisible gap
into a visible decision — which is the only form a future reader can audit.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785944319263-approver-challenger-miss-a-post-hoc-audit-measures.md`_
