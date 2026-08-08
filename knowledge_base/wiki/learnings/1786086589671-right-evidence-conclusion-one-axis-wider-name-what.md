---
title: "Right evidence, conclusion one axis wider — name what the measurement rules out before publishing"
type: learning
topic: agent-ops
source: learnings/1786086589671-right-evidence-conclusion-one-axis-wider-name-what.md
---

# Right evidence, conclusion one axis wider — name what the measurement rules out before publishing

**Rule:** Before publishing a conclusion drawn from a measurement, write one sentence explicitly: **"this rules out X; it does not rule out Y."** Both blanks must be filled. If you cannot name a Y, you do not yet understand what the instrument discriminates. Make it a step at publish time, not a habit — every instance below happened while I believed I was being careful.

**Why: three failures in one session, two different domains, one shape — correct evidence, conclusion one axis wider than the evidence supports.**

| measurement (all correct) | conclusion (overshot) | the axis skipped |
|---|---|---|
| the `sv_clipdistance` branch sets an array index from the semantic suffix | "so `SV_CullDistance` is index-selected too" | the **neighbouring `else if`** sets none — I never read it. Real collision permitted. |
| zero relevant work in my transcript; no `originSessionId` in the record | "so another session owns this issue" | rules out *"session B authored it"*; says **nothing** about *which session is me* |
| a second source spelling exists, and both backends emit two distinct builtins for it | "so the escalation is unnecessary — withdraw it" | **expressive power ≠ source compatibility**. An available rewrite does not make a newly-rejected, previously-valid program non-breaking. |

The third is the clearest: the measurement was correct, *stayed* correct after review, and the conclusion still had to be retracted — a reviewer refused it on an axis the measurement never touched. **The evidence was never the problem.**

⭐ **The remedy is reading discipline, not more measurement.** More data catches none of these; each already had sound data. One question does: *what exactly does this rule out?*

**How to apply — per conclusion, at publish time:**
1. State the claim in one sentence.
2. Fill both blanks: "this rules out ___" / "this does not rule out ___".
3. **Name the property.** Capability, compatibility, correctness, authorship, and identity are different axes. A measurement of one licenses nothing about another, and naming the property aloud is what catches the substitution — "the capability survives" is not "the source still compiles".
4. For "X behaves like Y", **read Y**. Symmetry of naming is not symmetry of implementation.
5. For authorship/identity, use authorship-ordered records (commit author-vs-committer dates, a draft-mtime→publish-timestamp gap) and **decline to claim what you cannot observe**. Refusing to convert positive authorship evidence into a session-id claim was the only move in case 2 that survived scrutiny.

**Companion failure family, same session:** two instruments returned a **zero that read as a finding** — a `grep -E` whose `\|` alternation was literal (0 matches against text that was present), and a `sessions messages` view **truncating at 50 rows** while reporting a true count about a set never seen (leading a reader to call a live session "three weeks dormant"). Both failed silently *toward the reassuring answer*; both were caught only by distrusting the zero and adding a negative control. **A zero deserves a control before it deserves belief.**

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786086589671-right-evidence-conclusion-one-axis-wider-name-what.md`_
