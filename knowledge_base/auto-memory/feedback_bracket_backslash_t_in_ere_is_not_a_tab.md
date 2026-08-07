---
name: feedback_bracket_backslash_t_in_ere_is_not_a_tab
description: "grep -E '[ \\t]+$' matches lines ending in the LETTER t (bracket sets take no escapes) — it reported 15 trailing-whitespace lines where the true count was 0, and I initially distrusted the correct instrument. Use [[:blank:]] or grep -P; when two of your own measurements of one quantity disagree, settle it with a control, not by preference."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 973fe4d6-47bd-4ca8-8434-3a07f3751993
---

# `[ \t]` in a POSIX ERE bracket set is {space, backslash, `t`} — not a tab

Measured 2026-08-06 while reviewing nanoclaw#1120
([[project_nanoclaw_1112_fail_closed_split]]).

```
grep -cE '[ \t]+$' live.md     →  15      # WRONG
grep -cE '[[:blank:]]+$' live.md →  0     # right
grep -cP '[ \t]+$' live.md       →  0     # right
python3: sum(l != l.rstrip())    →  0     # right
```

**Inside a bracket expression POSIX ERE takes no C escapes**, so `[ \t]` is the literal set
{space, `\`, `t`}. It therefore matches **every line ending in the letter `t`** — here line 84 of a
markdown file, `…/slang-maintain-release-report daily-repor`**`t`**, confirmed with `od -c` showing
the final bytes are `t \n` with no whitespace at all.

## The costly part was not the wrong pattern — it was which instrument I doubted

My grep said 15; my Python said 0. **I initially assumed grep was right** (more "direct", closer to
the file) and was about to publish "the committed snapshot still has 15 trailing-whitespace lines" as
a finding — a claim contradicting the PR's own stated cleanup, which had in fact worked.

⭐⭐⭐ **When two of your own measurements of one quantity disagree, that disagreement is the finding
until a control settles it.** Neither reading is privileged by feeling more direct. Resolve it by
constructing an input whose answer you know:

```
{ cat live.md; printf 'trailing space here \n'; } > ctl.md
[[:blank:]] → 1     grep -P → 1     python → 1     [ \t] → 16
```

The broken pattern's count moved 15→16 alongside the others, which is why it *looked* responsive; only
an absolute known-value control (0 real occurrences in the original) exposed the constant offset.
⭐⭐ **A pattern that tracks changes correctly can still be reporting a wrong baseline — a
differential control validates sensitivity, not calibration.**

## Rules

- **Never `[ \t]` in `grep -E`/`sed`/`awk` ERE.** Use `[[:blank:]]` (space+tab), `[[:space:]]`
  (adds newlines/CR/FF), or `grep -P '[ \t]'`. In `grep -P` the escape works because PCRE parses it.
- **`grep -c` returns matching LINES, not matches** — a separate way the same number misleads.
- A whitespace claim about a committed artifact is exactly the kind of low-stakes-sounding finding that
  gets published unverified. It was also **already refuted by the PR body**; ⇒ a measurement that
  contradicts the author's own stated verification deserves a control before it deserves a comment
  (same shape as [[feedback_control_the_instrument_not_the_reasoning]]).

Related: [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] (a grep whose *scope* is wrong),
[[feedback_a_guard_can_be_inert_and_read_as_passing]].
