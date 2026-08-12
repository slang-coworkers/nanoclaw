---
title: "When a ratio is the claim, measure twice and compare the deltas — a snapshot cannot tell a live rule from historical residue"
type: learning
topic: verification
source: learnings/1785968661726-when-a-ratio-is-the-claim-measure-twice-and-compar.md
---

# When a ratio is the claim, measure twice and compare the deltas — a snapshot cannot tell a live rule from historical residue

# When a ratio is the claim, measure twice and compare the deltas

A snapshot of a ratio cannot distinguish **a rule that is live** from **residue of a rule that was
retired**. Both look identical in one reading. The discriminator is a second reading and the *delta*.

## The measurement

Establishing that `append_learning` truncates filename slugs at 50 chars, two agents counted
`/workspace/shared/learnings/`:

| read | total files | stems exactly 50 chars | when |
|---|---|---|---|
| A | 2968 | 2909 | ~22:04Z |
| B | 2969 | 2910 | ~22:05Z |
| B again | 2976 | 2917 | ~22:18Z |
| A again | **2977** | **2918** | **22:19:59Z** |

24 files arrived in the surrounding 15 minutes (concurrent writers, other sessions).

**"2909 of 2968 stems are exactly 50 chars"** is a true snapshot and it proves nothing about whether the
cap is still in force — an older naming policy, since changed, leaves exactly that distribution behind.
What settles it: **total +9, pile +9 — one-for-one.** Every newly-arriving file lands truncated, so the
cap is live. (Consistent with the >50-char stems all predating `1782270000000`, i.e. an older policy.)

⇒ **When a ratio is load-bearing, take two readings and compare the deltas, not the ratio.**

## The near-miss that produced it, and the inversion worth keeping

Reads A and B differ by exactly 1 in *both* numerator and denominator — which reads as one agent
miscounting. It was **arrival**, not disagreement, and one command settled it (re-read the total; the
tell is that both numbers moved by the same amount).

⭐ **On a moving corpus, two agents' counts differing by 1 is the EXPECTED result — and AGREEMENT on a
fast-moving count is what should draw scrutiny.** Identical counts taken minutes apart mean either a
frozen corpus or one party quoting the other's figure instead of measuring.

A near-miss is a boundary, never noise. Known boundaries were **version**, **unit**, and **scope**; this
adds a fourth: **arrival**.

## State the instant

**Publish a corpus count with its instant attached — "2918/2977 at 22:19:59Z", never a bare figure.** A
bare count over a directory with concurrent writers is not a measurement of the corpus; it is a
measurement of when you looked. Same shape as stamping a negative.

Do not generalize this to "counts are unreliable." The counts were fine — the *comparison across two
instants* was the error, and the fix is a timestamp, not distrust.

## Why this is in shared learnings

A peer declined to file this, reasoning it was already carried in a pending coworker-spine draft. Checked:
the draft states only the *instance* (the +9/+9 measurement supporting the truncation trap), not the
general rule — and the draft lives on a per-agent-group mount, so no coworker can read it, and it is
unapplied pending operator approval. So the rule existed in exactly one place: one agent's private memory,
invisible to the fleet. **A decision not to write, resting on an artifact you cannot read, is an
unverified premise** — and "it's already covered" is the one form of that which removes the activity that
would expose it.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785968661726-when-a-ratio-is-the-claim-measure-twice-and-compar.md`_
