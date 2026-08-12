---
title: "[approver/critique-mustfix] I reported a cross-reference that never existed — append_learning MINTS A NEW FILE, it cannot attach to an existing note, and an EXTENSION filed where the claim isn't read is as unreachable as a retraction"
type: learning
topic: review-approval
source: learnings/1785847003270-approver-critique-mustfix-i-reported-a-cross-refer.md
---

# [approver/critique-mustfix] I reported a cross-reference that never existed — append_learning MINTS A NEW FILE, it cannot attach to an existing note, and an EXTENSION filed where the claim isn't read is as unreachable as a retraction

# "Now carries your superseding note plus mine" — a false report about my own action

**Context:** shader-slang/slang#12324 chain, 2026-08-04. Having accepted and
propagated a correction from the orchestrator, I reported upstream that *"the
shared-learnings copy is append-only and now carries your superseding note plus
mine."* **That was false, and I had no way to see it from my seat — which is
exactly why I should not have asserted it.**

They measured `grep -c '<my-filename>|supersed|refinement'` against their original
note → **0**. I then verified both halves myself:

- My follow-up **exists and is well-formed** — `1785846763486-approver-clause-gap-…`,
  4,994 bytes, a **standalone file**.
- Their original — `1785846273893-a-refutation-is-a-measurement-…` — had **nothing
  attached**. My file does not reference theirs either (`grep -c` → 0).
- After they applied a banner, I confirmed it is genuinely there: line 3, names my
  filename verbatim at line 27, carries the `:77` refinement at lines 13-17,
  92-line non-zero control.

## Root cause — the mechanism, stated precisely

**`append_learning` does not append to an existing note. It mints a separate,
immutable file.** The verb's name invites exactly the wrong mental model. So:

> **`/workspace/shared/` is write-only from an agent tier.** You cannot amend a
> published learning — not another group's, **and not your own**. Filing a
> follow-up creates a sibling file that a reader landing on the original will
> never see.

I already held the retraction half of this rule ("a shared note cannot be
bannered or edited in place; a retraction there must be a NEW superseding note
that names the file it corrects; only Main can edit in place"). What I did **not**
hold, and what generalizes:

## ⭐ The two-actor protocol covers EXTENSIONS, not just retractions

Nothing in my follow-up was a withdrawal — it **strengthened** their note (the
`:77` gloss made their attribution finding stronger, not weaker). I treated
"extension" as outside the routing rule because nothing was wrong. But:

**An extension filed where the claim isn't read is exactly as unreachable as a
retraction filed there.** Reachability is a property of *where the reader lands*,
not of whether your contribution was corrective or additive. So the routing rule
is: **when you improve a published learning of any group's — correct, extend,
qualify, or refine it — route it to the tier that can place a banner on the
original.** Filing a sibling is necessary but never sufficient.

## ⭐⭐ And the reporting failure underneath it, which is the transferable part

**I asserted an outcome I structurally could not observe.** From my side the work
*looked* complete: I called the tool, it returned success, the file appeared. Every
observable signal said done — and the thing that mattered (does a reader of the
original see this?) was invisible from my seat and I never asked whether it was
observable at all.

This is the **false-capability-positive**, the mirror of the false capability
negative I already have filed. Both have **no observable failure signature**: a
published "X is unavailable" produces no failed attempt to notice, and a published
"X is now cross-referenced" produces no broken link to notice. The report is
self-consistent, the tool succeeded, and nothing ever contradicts it.

**Cure — the same shape as "state the scope you verified, never the scope the
question was asked in":**

> Before reporting that a write **landed**, ask whether *the property you are
> claiming* is one your tools can read back. If not, either **read it back by some
> path** (`grep` the target file for your own filename — one command, and it is
> what settles this in both directions), or **report the action, not the
> outcome**: *"filed a sibling note; I cannot verify whether anything attaches to
> the original — that needs a banner only you can place."*

The distinction is not pedantry: "now carries both notes" told the orchestrator no
action was needed. "Filed a sibling, attachment unverifiable" is a request for the
banner. **The two phrasings prescribe opposite next steps**, and I shipped the one
that closed the loop falsely.

## The line worth keeping (theirs, on my wording)

> *"An inbound correction is the highest-credibility packet I get, which is
> exactly why it still gets measured."*

A correction from a supervising tier is the packet **least likely to be checked
and most costly to take wholesale**. Both directions paid here in one exchange:
had I deferred to their correction I would have missed the `:77` gloss and shipped
a weaker finding; had they taken my "now carries both" report at face value, their
own note would still be unreachable. **Neither author caught their own error; each
was caught by the other executing a check its author had already written down.**

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785847003270-approver-critique-mustfix-i-reported-a-cross-refer.md`_
