# [approver/critique-mustfix] CORRECTION to my own #12322 note — a maintainer's preference is SUPPORTING context for clearing a repo-guideline finding, never the primary basis; lead with the technical grounds

# Correction: I filed the right call with the wrong reason ORDER

**Supersedes the emphasis (not the verdict) of my earlier learning**
"[approver/calibration] A bot finding that a named human maintainer already
overruled ON THIS PR is not an OPEN_GAP…" — written the same day, while deciding
shader-slang/slang#12322 @`ba156ebf5c900ff89189c15347bafded7b4280ee`.
The verdict there (gap CLEARS) survived independent critique. **The reasoning
order did not.**

## Symptom

I cleared a duplication finding (Devin's only finding + CodeRabbit 🟠 Major,
both citing the repo's "keep one source of truth" guideline) and made the
**decisive** reason: *a named human maintainer explicitly asked for this shape,
and the author complied.* The DECISION_REVIEW critique flagged exactly that
framing:

> Maintainer preference alone should not clear a repository rule, but here the
> duplicated operation is trivial, the paths are necessarily disjoint, and no
> documented single-source rule was evidenced. Record those technical reasons as
> primary and the maintainer request as supporting context.

## Root cause

"A human already ruled on this" is an argument about **process** (the
"human must look" step happened), not about **substance** (whether the code is
actually fine). Leading with it means:

- if the maintainer's preference had been *wrong* on the merits, my derivation
  would have produced the same clear — the reason doesn't discriminate;
- it is indistinguishable, from the outside, from **laundering a real guideline
  violation through an authority's style preference**. That is the failure mode
  the critique named, and my write-up gave a reader no way to rule it out.

An auditable decision has to state grounds that would *fail* if the code were
actually defective. Deference to authority never fails that way.

## The technical grounds that DO carry it (what I should have led with)

For #12322 specifically — the 3-line predicate duplicated at
`tools/slang-test/slang-test-main.cpp:1531` and `:4654`:

1. Neither bot claims either site **behaves** incorrectly; Devin's own category
   field reads "Repo rule" and its impact text is about *future* drift.
2. The duplicated operation is trivial — a literal string compare plus one
   **idempotent** OR (`addUsedBackEnd`, `tools/slang-test/test-context.h:55-62`).
3. The two paths are **necessarily disjoint**: the Diagnostic branch returns
   `TestResult::Pass` at the top of `runTest` (`:4652-4659`) before dispatch, so
   the other site is unreachable for those tests. The copies cannot disagree at
   runtime today.
4. **No documented single-source rule covering this case was evidenced.** The
   cited guideline targets re-implementing *mappings/classifications at call
   sites*; the sibling requirement checks in the very same function
   (`-pass-through` at `:1511`, `-target` at `:1521`) are themselves inline — so
   the inline shape IS the local convention, not a deviation from it.
5. Residual risk is real but future-only ⇒ advisory maintenance note, not a gap.

Only *then* does the maintainer's request belong in the record, as corroboration
that a human weighed the same tradeoff and chose readability.

## The transferable rule

**When clearing a finding that cites a repo rule, the primary basis must be
technical: is the rule actually violated, and if so what is the concrete harm?
A maintainer's stated preference is supporting context — it corroborates a
conclusion, it cannot substitute for one.**

Test for whether you've ordered it right: *strike the human's comment from the
record — does the clear still stand on its own?* If not, you are deferring, not
deciding. (Point 4 above is the one that most often settles it, and it is the one
I skipped: **check whether the cited rule actually covers this case, and whether
the surrounding code already follows the shape being flagged** — the sibling
inline checks were three lines away in the same function.)

## Also worth keeping from the original note

Still correct and unretracted: two bots agreeing raises confidence about the
**observation**, not the **severity** — independence of tools is not independence
of premises when both apply the same written style rule. And a "Bug"-labelled
finding whose own body claims no incorrect behavior is a severity-presentation
artifact; read the category and impact text, not the glyph.

## Fix applied

Rewrote the gap-severity section of the decision record
(`work/12322-ba156ebf5c90/investigation.md`) to lead with points 1–5 and demote
the maintainer request to explicitly-labelled supporting context, with a note in
the artifact itself that preference alone must not clear a guideline finding.
Decision unchanged: WOULD_APPROVE.
