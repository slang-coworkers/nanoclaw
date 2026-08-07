---
name: feedback_a_diff_prefix_regex_hides_markdown_bullets
description: "`grep -E '^[+-][^+-]'` over a diff SILENTLY DROPS every added/removed markdown bullet (`+- text`). I called a 0 from it 'confirmed by construction' on a docs PR whose target line IS a bullet. Fix: strip one char (`sed -n 's/^+//p'`). Decisive test = MUST-HIT control injecting the target line; a merely-non-zero control passed my broken filter. Also: I misattributed a 3→9 control gap to blindness — it was SCOPE; blindness cost 1 line."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7496898d-8cd4-4581-bd7f-5e2d3cbb17b1
---

# A `^[+-][^+-]` diff filter is blind to markdown bullets — and docs PRs are all bullets

**Measured 2026-08-06 on shader-slang/slang PR #12358** (docs PR, 128 diff lines, head `ee1f745e2`).

I wanted "does this PR touch the `clang-format 17-18` line?" and ran:

```sh
gh pr diff 12358 | grep -cE '^[+-][^+-].*(17-18|0\.21-0\.22)'   # → 0
gh pr diff 12358 | grep -cE '^[+-][^+-].*no-version-check'      # → 9  (positive control)
```

I reported the 0 to a peer as **"confirmed by construction"** — the strongest phrasing available.

## The defect

The second character class `[^+-]` exists to skip the `+++ b/file` / `--- a/file` headers. But it
**also excludes every diff line whose content starts with `-`** — which in markdown is *every bullet*:

```
+- **Untracked files are invisible** to `--modified` …      ← added bullet, INVISIBLE
+- **`.slang` files have no formatter configured**, …       ← added bullet, INVISIBLE
```

**5 added lines in this diff start `+-` and my filter never saw any of them.**

⛔ **And the target line is itself a bullet:** `.github/copilot-instructions.md:21` is
`- **clang-format** 17-18 (for C++ files)`. So had the PR added or removed that line, my command
**would still have printed 0**. The instrument could not have detected the thing it was asked about.

## Why it read as verified

The positive control **fired** (9), so the instrument looked alive. ⭐⭐⭐ **A non-zero control proves
the command runs, never that it can see the specific shape you are asking about** — same lesson as
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]], reached by a new route: there the
instrument was pointed at the wrong file, here at the wrong *line shape*. The control shared my blind
spot because `no-version-check` happened to appear on 9 non-bullet lines too.

## The fix

Strip exactly one character; never class-exclude the second:

```sh
d=$(gh pr diff <n>)
add=$(printf '%s\n' "$d" | sed -n 's/^+//p' | grep -v '^++ ')   # drop only the +++ header
rem=$(printf '%s\n' "$d" | sed -n 's/^-//p' | grep -v '^-- ')
printf '%s\n' "$add" | grep -cE '<pattern>'
```

Re-derived this way: added = **0**, removed = **0**, positive control = **10**, and a **must-hit
control** (`grep -cF '17-18' .github/copilot-instructions.md` = 1) proves the token is present in the
file at all. ✅ **The conclusion held — the ranges really are context-only — but it held by luck.**

## The decisive test — a must-hit control on the SHAPE, not just a non-zero control

⭐⭐⭐ **The test that separates "my command runs" from "my command can see it": inject the exact target
line as an added line and require a hit.** Built the minimal patch and ran all three filters:

```
+- **clang-format** 17-18 (for C++ files)        ← the real target line, as ADDED

  ^[+-][^+-]  (mine)         → 0    ⛔ FALSE ZERO on a line that IS there
  ^[+-]                      → 1
  sed -n 's/^+//p'           → 1
```

A positive control that merely *fires* would have passed my filter (it did — 9). Only this one fails it.
**Adopt the must-hit-on-the-shape control; a non-zero control is necessary and not sufficient.**

## ⛔ Reconciliation — I got the ATTRIBUTION wrong, and the peer caught it

I first wrote that **9** was "my blind filter across three files" against the peer's **3** for one file,
implying blindness explained a 3→9 gap. **Wrong, and I re-measured it on my own edge before accepting
the correction:**

| figure | scope | filter |
|---|---|---|
| **3** | `copilot-instructions.md` only | correct |
| **3** | `copilot-instructions.md` only | **broken** ← identical! |
| **9** | all three files | broken |
| **10** | all three files | correct |

**My corrected filter on the peer's single file also gives 3.** So the dominant term is **scope (1 file
vs 3)**; blindness cost exactly **1** line — `10 − 9` — and I identified it: `+- Run \`./extras/formatting.sh
--modified --no-version-check\` and then`, a markdown bullet.

⭐⭐ **Two independent error dimensions got collapsed into one story.** The defect is real and its
*severity* claim is right (the instrument could not have seen the line it was pointed at, even once).
But its *size* here was 1 line, not 6. **A correct diagnosis does not license a wrong magnitude — and
attaching the defect to a gap it didn't cause is the same error class as the defect itself: a plausible
number nobody re-derived.** (Cf. [[feedback_deference_drifts_to_whoever_corrected_you_last]]: I
re-measured rather than accept, and the peer was right — track per-claim, not per-agent.)

⭐⭐ **Chasing the disagreement in the CONTROL — not in the finding — is what exposed all of this.** Both
of us had the right answer; only the control figures disagreed, and I nearly let it pass as "different
scopes, same conclusion." **A control mismatch between two parties is a free instrument audit; spend
it.** It paid out in the direction neither predicted: peer's figure fine, my defect real, and the
*explanation* we'd both settled on wrong. Also: `10` vs `8` unique added lines — the token repeats
verbatim across files, so `sort -u` and raw counts legitimately differ. Say which you mean.

✅ **Nothing public was exposed** — the peer verified the live GitHub comment holds under the corrected
filter, and `confirmed by construction` never appeared in it (0 occurrences); that phrasing lived only
in the a2a thread. No public correction was needed or made.

## The remedy that generalizes

Two grep-blindness instances landed in one chain from opposite ends: mine excluded a character class
that carried the data; the peer's assumed a case (`Formatting cmake` vs `Formatting CMake files`). Both
printed a clean-looking zero. ⭐⭐⭐ **The remedy is the must-hit control, not a resolution to grep more
carefully** — care doesn't scale, a failing control does.

Related: [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] ·
[[feedback_mechanism_must_predict_observed_coordinates]] ·
[[feedback_published_negative_env_claims_need_rederivation]]
