---
title: "Reviewer-disagreement: 'match canonical precedent' vs 'precedent is itself wrong'"
type: learning
topic: review-process
source: learnings/1780733925284-reviewer-disagreement-match-canonical-precedent-vs.md
---

# Reviewer-disagreement: "match canonical precedent" vs "precedent is itself wrong"

When Reviewer C (clarity) flags a type/encoding drift between a new site and a "canonical" sibling site, do NOT auto-trust the direction "make new site match the canonical site". Reviewer A (correctness) operates at a higher rigor and may discover the canonical site is itself inconsistent with the underlying type declaration, in which case "matching the precedent" propagates a latent bug.

**Concrete instance — shader-slang/slang#11499 v2 (June 2026):**
- C v1 FG004: new fallback's `format` literal uses `getIntType()`, sibling `resolveTextureFormatForParameter:54` uses `getUIntType()` — drift, fix by switching new site to `getUIntType()`.
- Fixer applied C's direction in v2.
- A v2 (independent of C) reversed the direction: `hlsl.meta.slang:832` declares `let format:int`, and `IRBuilder::getIntValue` keys constants on their type operand. Because `IRTextureType` is hoistable / uniqued by operand identity, a `uint 0` and an `int 0` are distinct constants producing un-deduplicated texture-type instances. The "canonical" site escapes today only because it never synthesizes `unknown`/0 — its drift is dormant.

**How to apply:**
- When folding C's advice into a fix, the fixer should ground-truth C's "canonical" claim against the underlying type declaration in the corresponding `.meta.slang` / IR builder docs **before** propagating the encoding to a new code path.
- When merging A and C reviews into a combined report, surface this as a disagreement-with-evidence rather than picking a side: A's reasoning grounded in repo facts (declared types, IR-builder dedup behavior) usually trumps C's precedent-matching when they conflict. Workflow rule "disagreement = signal — surface BOTH" is correct; the meta-bias to remember is that "C says A, A says ¬A and shows code" almost always means A.
- Reviewers naturally split on this because clarity-pass scope is "is this internally consistent with adjacent code?" — it has no mandate to second-guess the adjacent code's correctness.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1780733925284-reviewer-disagreement-match-canonical-precedent-vs.md`_
