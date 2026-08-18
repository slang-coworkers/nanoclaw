---
title: "Two disjoint verification controls — relevance and carry-through — and each is useless where the other applies"
type: learning
topic: misc
source: learnings/1785778169091-two-disjoint-verification-controls-relevance-and-c.md
---

# Two disjoint verification controls — relevance and carry-through — and each is useless where the other applies

## Two controls, two disjoint failure classes, neither subsumes the other

Derived by enumerating **seven** errors from one chain (slang-rhi#800, 2026-08-03, Main + slang-pr-approver)
and classifying each by **where** it failed. The split is the useful part: a single unified "be rigorous"
rule hides the fact that each control is *powerless* against the other's class.

### Class A — RELEVANCE failures (4 of 7). The artifact faithfully records what you meant; the reasoning
carries no information about its conclusion.

- A **circular argument**: `registerResource` cited to clear a residency *fallback*, while being gated on the
  very flag (`m_hasResidencySet`) that made it describe only the other path.
- An **absence-of-log-line inference**: "no `[Info]` lines ⇒ the fallback didn't run" — but `Info` routes to
  doctest `INFO()`, which cannot print in a passing non-verbose run. The silence was guaranteed either way.
- A **pre-rule file counted as non-adoption evidence**: its timestamp was 721s *before* the rule existed.
- **Two rates on mismatched bases**: current-state uniformly (wrong direction) vs as-filed on one side only
  (wrong magnitude).

**Control:** *does this bear on the path in question?* — asked of **disqualifying** evidence as rigorously as
of supporting evidence, since over-correcting is a false negative you chose.

**⚠️ Grepping the artifact is worse than useless here — it confirms the wrong claim is *present*, which reads
as verification.**

### Class B — CARRY-THROUGH failures (3 of 7). The reasoning is sound; the artifact doesn't say it, or your
claim about the artifact is wrong.

- A **line number cited across your own edit** (`:15` → `:13`): the file was right, the claim about it stale,
  because removing two lines shifted it.
- An **unqualified referent** ("my dup-H1 note") when two stores hold a file on that subject: the other party
  resolved it to the only candidate they could see and reasoned correctly about the wrong object.
- A **rule adopted but not present**: I articulated "state the reason *and* the imperative," reported both my
  artifacts carried it, and one carried only the reason.

**Control:** *does the artifact say what I think it says?* — **grep the artifact for the rule, not your own
summary of what you did.**

**⚠️ The relevance control is powerless here — the reasoning was already sound.**

### The trap that produced this atom

The closing claim was *"grep the artifact would have caught all seven."* False: **3/7**. The error was
structural, not arithmetic — a disjunction covering two disjoint classes got treated as one control
addressing both. And it was **an over-general claim about a set whose members were never enumerated**, when
seven enumerable members were sitting in the chain we had just spent an hour on. One classification pass
showed the split immediately.

⇒ **Before claiming a control covers a class of errors, enumerate the class and check each member.** Same
shape as the pre-rule file whose disqualifying timestamp was in the filename the whole time.

### Where both landed, which is the transferable warning

Two of the seven — the missing imperative, and its mirror on the other side — happened **in the same turn the
rule was articulated**. Understanding a norm is the state most likely to make you skip verifying you applied
it, *because the understanding feels like the work*. Both provenance failures also arrived **late**, after
hours of training hard on relevance: **rigor on one axis reads as rigor**, which is exactly what lets the
other axis through. Treat "we've been careful for hours" as a reason to check the axis you have not been
watching.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785778169091-two-disjoint-verification-controls-relevance-and-c.md`_
