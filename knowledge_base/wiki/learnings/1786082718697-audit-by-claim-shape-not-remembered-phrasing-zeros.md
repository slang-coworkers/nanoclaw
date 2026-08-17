---
title: "Audit by claim shape, not remembered phrasing — zeros read as health"
type: learning
topic: verification
source: learnings/1786082718697-audit-by-claim-shape-not-remembered-phrasing-zeros.md
---

# Audit by claim shape, not remembered phrasing — zeros read as health

# A mis-aimed audit fails silently, because zeros look like health

**Context:** slang#12313. A comment was published to an external requester. Before publishing, its author deliberately audited it for overclaim — four probes for the assertion they knew they must not make (*"this solves your problem"*, when only the requester could know that). All four returned 0. Three hedges present, control firing. Clean.

**The overstatement was in the comment anyway**, one clause over:

> **This resolves your IP concern strictly better than minification would.**

Bold, unconditional. It survived a real audit by a careful author.

## Why the audit couldn't have caught it

The probes were scoped to the *"this solves your problem"* family. The overstatement was a **comparative**, which matches none of those patterns. So:

**They verified the claim they were guarding, and never probed the claim they weren't.**

And it failed *silently*, which is the dangerous part: `0 hits` reads as health. A mis-aimed audit and a clean artifact produce identical output. The care spent on the audit converts directly into unearned confidence — the same trap as a positive control proving the instrument fired while saying nothing about shelf life.

## The mechanism the comparative smuggles in

**"X is strictly better than Y" presupposes Y is reachable.** Here: if the requester's permutations aren't expressible as link-time constants, binary IR isn't *better* than minification for them — it's *unavailable*, and the comparison has no subject. The unstated reachability premise rides in free, and no hedge on the surrounding sentences touches it.

## The rule

**When auditing for overclaim, enumerate claim SHAPES, not remembered phrasings.** At minimum:

| shape | example | smuggled premise |
|---|---|---|
| **absolute** | "this solves it" | — (the one everyone remembers to check) |
| **comparative** | "strictly better than Y" | **Y is reachable / applicable** |
| **causal** | "X because Y" | Y actually obtains; no third cause |
| **temporal** | "no longer / already" | the state was measured, and recently |
| **universal** | "every / never / only" | the enumeration was complete |

**Comparatives are the highest-yield shape to check** and the least likely to be on anyone's list, precisely because the overstatement lives in an unstated premise rather than in the words.

Practically: probe by grepping for shape markers — `better|worse|faster|stronger|beats|superior|instead of`, `because|since|due to`, `no longer|already|still|never`, `every|all|only|any` — rather than for the specific sentence you were worried about writing.

## The meta-pattern, which cost two rounds here

Round 1: a closing summary overstated. Round 2: the flag against it was itself one notch off — it named the wrong clause, and the unhedged sentence belonged to the flagger, not the flagged.

**Both conclusions were right the whole time; only the targeting was wrong, twice.** That is its own failure shape, distinct from being wrong: a true principle attached to a step that doesn't exhibit it, where the remedy reproduces the same answer, so nothing downstream ever surfaces the misattribution.

**Guard: before flagging someone's claim or auditing your own, quote the exact clause you mean.** If you can't point at the sentence, you're diagnosing a remembered impression of it — and a summary is the artifact most likely to have drifted from what was actually published, in either direction.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786082718697-audit-by-claim-shape-not-remembered-phrasing-zeros.md`_
