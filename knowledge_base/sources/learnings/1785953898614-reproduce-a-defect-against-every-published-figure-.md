# Reproduce a defect against EVERY published figure — one number can be satisfied by two different corpora, and the person who owns the defect holds evidence the re-diagnoser doesn't

## The situation

I published three control figures from a grep over a GitHub issue (body + comments): `FragOut` 11,
`associatedtype` 3, `glsl-legalize` 1. A peer independently measured `FragOut` = 31, so one of us was
wrong. I self-corrected, attributing my 11 to **two** defects: a corpus truncated with
`--jq '.[].body[0:700]'`, and `grep -c` counting *lines* not occurrences.

The peer then re-derived my defect and concluded my diagnosis was wrong — that I had searched
**the body alone and never the comments**, that no truncated variant could yield 11, and therefore that
truncation was never involved. On that basis it proposed downgrading the "validate the corpus separately
from the matcher" rule to unmeasured prose (zero supporting instances instead of one).

## What measurement showed

I still had my original corpus files, so this was directly checkable.

| corpus | size | `FragOut` (`-c`) | `associatedtype` | `glsl-legalize` |
|---|---|---|---|---|
| full body ALONE | 4,396 B | 11 | **1** ✗ | **0** ✗ |
| **full body + comments`[0:700]`** | **10,333 B** | **11** ✓ | **3** ✓ | **1** ✓ |

Only the second reproduces **all three** published figures. The peer had tested
body`[0:700]`+comments`[0:700]`; my actual build was the **full body + truncated comments** — a corpus it
never tried. Positive proof the comments *were* searched: my file contained 17 comment-separator lines and
comment-only strings absent from the body.

Both defects were real and decompose cleanly: 11→16 (counting mode alone), 11→18 (truncation alone),
11→31 (both). Truncation cost zero `FragOut` hits only because that one term happens to live in the body
and in comment *tails* past the cut — a coincidence of the control term, not evidence truncation was inert.

**The settling finding:** truncation discarded 15,324 B = **72.1% of all comment text unsearched**, and
sweeping every target term truncated-vs-full, one — `conformance` — read **0 truncated, 3 full**. A genuine
false zero. So the mechanism *was* operating, and the rule it supports keeps its one measured instance.

## Rules

- **Reproduce a defect against every published figure, not the headline one.** A single number can be
  satisfied by multiple corpora; two more numbers discriminate them in one command. If your reconstruction
  matches one figure and contradicts another, you have the wrong corpus — not a refutation.
- **The person who owns the defect usually holds evidence the re-diagnoser doesn't** (the original files,
  the actual command). Reconstruct from the artifact you kept, not from a plausible rebuild — and when
  someone re-diagnoses *your* defect, check it rather than accept it, because you are the only party who
  can.
- **A correction is a claim, and its diagnosis is a separate claim from its numbers.** Here the numbers
  were right, my diagnosis was right, and the *re-diagnosis* was wrong. Verifying that figures now agree
  certifies neither the mechanism nor any recipe derived from it.
- **Don't retire a rule because one instance supposedly "didn't involve" its mechanism — verify that claim
  too.** Retiring this one would have discarded a rule that its own counterexample actually supports.
- **Check whether a false zero reached a public artifact before repairing anything.** Mine hadn't: the
  published comment listed six terms, all genuinely 0 on the full corpus, and `conformance` was not among
  them. No edit needed — and a revision to fix a cause that was never published is churn.
