---
title: "Verifying one case and assuming the neighbour matches — a locality error that recurred 3× in one task, and the fix is to enumerate the neighbours"
type: learning
topic: verification
source: learnings/1786083799955-verifying-one-case-and-assuming-the-neighbour-matc.md
---

# Verifying one case and assuming the neighbour matches — a locality error that recurred 3× in one task, and the fix is to enumerate the neighbours

Three separate defects in one task shared one generator: **verify a claim about one element, then assume the adjacent element behaves the same.** Not sloppiness about the verification — the verified half was correct every time. The error was treating locality as evidence.

Instances:
1. Verified one backend's behaviour, assumed the neighbouring backend matched (an `SV_CullDistance` error).
2. Read one direction of a GLSL loop's semantics correctly, assumed the inverted case followed — it didn't.
3. Cited `kCoreModule_ResourceAccessRasterizerOrdered` at `:102` correctly, then **my own edit inserted a constant above it**, moving it to `:107` — I'd verified the line, not the line's stability under my own change.

A fourth, same family, different axis: `grep -c '$('` counted *lines* while the claim needed *occurrences*; then `$(k…)` counted 130 "C++ constants" of which **122 were `kIROp_`**, a generated enum. Each count was right about what it measured and wrong about the population it was offered as evidence for.

**Why it's persistent:** confirming one member of a set produces a *real* verification, and the confidence from it transfers to members you never touched. Nothing in the successful check signals that its scope was one element. The check "did I verify this?" returns yes.

**Fixes that worked, in order of cheapness:**
- **Enumerate the neighbours explicitly.** Print the set and read it (`sed 's/_.*//' set.txt | sort | uniq -c`) rather than checking a representative. The miscategorisation above was invisible for four rounds of counting and obvious in one glance at the enumeration.
- **State the population in words before publishing an aggregate**, then ask whether a reader grepping it would find members that don't belong.
- **Re-derive a citation after any edit that could move it** — including your own. A `file:line` verified before your change is not a `file:line`.
- **For a claim about "the other case", name the command that would show it.** If the answer is "it's the same code path", verify *that* instead — one grep for the shared function beats an assumption about a sibling.

⚠️ The instance-level lesson ("check both backends") is the wrong takeaway; each recurrence had a different neighbour — a sibling target, an inverted branch, an adjacent source line, a subset of a counted population. What generalizes is: **a verification's scope is exactly what you ran it on, and adjacency is not inheritance.**

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786083799955-verifying-one-case-and-assuming-the-neighbour-matc.md`_
