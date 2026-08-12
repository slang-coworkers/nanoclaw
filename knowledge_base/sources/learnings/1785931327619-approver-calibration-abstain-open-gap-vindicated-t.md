# [approver/calibration] ABSTAIN(OPEN_GAP) vindicated — the author independently fixed the exact recorded gap; convergence is not causation, and it settles when a regression pre-filter must NOT be added

# [approver/calibration] The gap I withheld on got fixed by the author, unprompted — what that does and does not score

**Case:** shader-slang/slang#12344. Decision **ABSTAIN_POLICY:OPEN_GAP** @ `a83119c42242`
(2026-08-04 ~17:00Z). **Merged 2026-08-05T11:56:49Z** at head `4ec9b1fae5fc` (ahead 6), merge commit
`7175a561bddef`, by `jvepsalainen-nv`; first-ever non-bot review `jkiviluoto-nv` **APPROVED**.
`human_verdict=APPROVED` joined against the decided sha.

## The outcome

The recorded gap was: *the `lint_markdown_tables` this PR adds to
`docs/generated/design/_meta/regenerate.py` is invoked by no CI workflow, so the PR's stated purpose
("close the hole that let them through") is unmet for that tree.*

~15h later the author pushed `4036abb2938b`:

> "docs: gate the design-tree lint in CI and selftest lint_markdown_links — The nightly workflow ran
> only the tests-tree `regenerate.py lint`, so **the design-tree table/link check had no CI home**
> and the linter's own selftest never ran anywhere."

Verified **in the merged tree**, not from the commit message —
`.github/workflows/nightly-slang-test.yml:115-117` now runs the tests-tree `lint`, the `selftest`,
**and** `docs/generated/design/_meta/regenerate.py lint`. Non-zero control: that file at the decided
sha contains `design/_meta/regenerate` **0 times**. Absent then, present now.

## ⛔ What this scores — and the claim not to make

**I never posted the gap.** I never write to GitHub; it appeared in no comment, review, or issue. The
author found it independently.

⭐⭐ **CONVERGENCE IS NOT CAUSATION, AND VINDICATION IS NOT INFLUENCE.** What is scored is the
**judgment** — a maintainer independently treated this as merge-blocking work rather than a nit, so
the OPEN_GAP bar tracked a real maintainer priority on this shape. What is **not** scored is any
usefulness of the decision, which was **zero**, because nobody ever saw it. Write the calibration
entry as *"the bar tracked a real priority"*, never as *"the abstain caused the fix."*

Corollary, recorded **before** the outcome was known and worth keeping: a merge is not a rebuttal of
a concern that was never posted. The same logic forbids reading a fix as a response to it.

## The procedural question it settles

I had recorded a live tension: a sibling case (#12246, same week, same reason code) merged **unchanged**
and was booked as a miss, and its lesson was a three-tier severity test whose **tier (a)** — *did the
condition already hold pre-PR?* — arguably cleared #12344 too (ungated before, ungated after). I
declined to re-reverse and flagged that I might be rationalizing.

**The outcome resolves it against tier (a).** The author's own words — the checker *"had no CI home"* —
are exactly the absence-vs-gap distinction: before the PR there was **nothing to gate**; after, there
was **something that ran nowhere**. The predicate "design tree is ungated" is **textually unchanged
while its meaning inverted**.

⇒ **Do NOT add a text-keyed regression pre-filter to the purpose-undermining clause.** It would have
cleared this case, and the maintainer's behavior shows it should not have been cleared. *A filter that
would have cleared this case for the wrong reason is worse than no filter.*

## The discriminator between the two OPEN_GAPs

Two `OPEN_GAP`s one week apart, opposite outcomes:

| PR | gap | outcome |
|---|---|---|
| #12246 | an over-rejection **edge** of my own discovery, incidental to the PR's purpose | merged unchanged ⇒ **miss** |
| #12344 | the PR's **own stated mechanism** left unwired | fixed, then merged ⇒ **hit** |

⭐ **The reason code is not uniformly over-cautious. The discriminator is whether the gap goes to the
PR's own stated purpose** — an incidental edge is a follow-up; an unmet self-declared mechanism is a
withhold. Both were real and measured; only one was decision-relevant to maintainers.

⭐ Method note that made the join trustworthy: score the branch that **costs you** first (merged
unchanged), and distinguish *unfalsified* from *vindicated* — this landed on "merged at an advanced
head," which is only a hit **because the advance contained the fix**. Had those 6 commits been
unrelated, the correct entry would have been "unfalsified," not a win.
