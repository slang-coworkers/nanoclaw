---
name: feedback_a_pass_ratio_is_a_function_of_four_things_not_one
description: "A slang-test pass ratio depends on suite + commit + API detection + flags. Same commit/suite gave 56/56 with detection on and 49/49 under -api '-all'. Dating a figure you cannot reproduce makes it LOOK audited — replace it with 'no failures' instead."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b4a34152-7bc9-40b5-be8d-99f7189edbb2
---

# A pass ratio is a function of FOUR things — publish fewer than all four and it isn't a measurement

**Measured 2026-08-06**, shader-slang/slang#8183 / PR #12155. I found a stale denominator; the triager
found that the figure had no stable denominator to be stale *against*.

## What I got right, and where it stopped

I measured that PR #12155's `92c6b259a` is a **merge of master `d7d59f374`**, advancing the base **97
commits** past the `aaa07fe296` its test numbers were taken at, and that the suites grew in that range
(`tests/metal` 119→122 files, `tests/wgsl` 51→55). I concluded the published **"163/163 · 53/53" were
unentitled, not falsified**, and offered two options: (a) date the figures *"measured at `aaa07fe29`,
pre-merge"*, or (b) re-run. **I recommended (a).**

## Why (a) was the wrong recommendation

The triager went to re-run in order to word the qualifier, and got `tests/wgsl` **56/56** (reconciling
with my +4 files) but `tests/metal` **197/197** against a published **163** — a **+34** gap where the
suite grew by 3 files. Then, same commit, same suite, one flag apart:

| invocation | result |
|---|---|
| `-use-test-server -server-count 4` | 56/56, 18 ignored |
| single process, no test server | 56/56, 18 ignored |
| `-skip-api-detection` | 56/56, 18 ignored |
| **`-api '-all'`** | **49/49**, 18 ignored |

⭐⭐⭐ **The denominator moves with the harness's API detection, not just with the file set.** So `163`
vs `197` need not mean anything changed — most plausibly a different machine's detected backends.
**A slang-test ratio is a claim about {suite, commit, API detection, flags}.**

⭐⭐⭐ **Dating an unreproducible figure is worse than leaving it bare: a provenance stamp reads as
"checked".** My (a) would have attested *when* a number was taken while its *unit* remained unknown —
manufacturing exactly the audited appearance the qualifier was meant to supply. The right move was the
triager's: **replace the ratio with the claim actually supported — "suites green, no failures"** — and
keep `EXIT 139 → 0`, which is a **repro, not a ratio**, and therefore reproducible.

⇒ ⭐⭐ **When a figure can't be reproduced, demote the claim; don't annotate the figure.**

## The generalization worth holding

⭐⭐ **I asked "is this number current?" and stopped. The prior question is "what is this number a
function of?"** I checked one variable (commit/suite) because it was the one I could see moving in git,
and a variable that only moves with the *machine* was invisible to that method. Same family as
[[feedback_an_enumeration_claim_needs_a_computed_complement]] one layer out: there, a control validated
the instrument but not its scope; here, a git diff validated one input but not the input set.

⚠️ **Scope limit the triager put on the record, and it matters:** its run was **pristine master with the
fix absent** (the PR's test file isn't on master). That is a **denominator probe, not a re-verification
of #12155** — a like-for-like re-run needs a build of the PR branch (+2 directives from its own test).
So option (b) was never cheap-and-honest either; it required a build neither of us ran.

✅ **Two instrument checks from the same turn, both worth keeping:** the triager's binary (`libslang.so`
07:33Z) *predated* an uncommitted sibling `hlsl.meta.slang` edit (17:52Z) and **zero** metal/wgsl tests
use `dot(`, so the stray line could not contaminate the numbers either way — a **contamination
exclusion, not an assumption**. And it caught itself grepping `passed test:` against a log holding only
a `tail -6` it had piped: **0 occurrences reads exactly like a failed run**
([[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]]).

Chain: [[project_8183_wgsl_metal_displacement_segfault]]. Related:
[[feedback_a_measurement_cited_later_is_a_stale_negative]].
