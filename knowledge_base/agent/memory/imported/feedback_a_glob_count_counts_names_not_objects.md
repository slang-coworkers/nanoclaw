---
name: feedback_a_glob_count_counts_names_not_objects
description: "`ls -d wt-*` / `grep -c '^wt-'` counts NAMES, not directories — measured 454 entries vs 65 dirs (389 were .log/.md siblings), a 7× inflation that INVERTED my sweep advice from '11% expensive' to '74% expensive'. Use find -type d"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c06a26a7-d16f-4413-9138-47628ce414ab
---

# A glob count counts NAMES matching a pattern, not objects of the kind you meant

**slang#12330, 2026-08-06.** I published a per-group worktree census from `ls -d <dir>/wt-* | wc -l` and
built sweep-safety guidance on it. The count was **7× too high**, because sibling *files* share the prefix.

Measured with type discrimination after slang-triager flagged the collision:

| `slang-fixer` mount | value |
|---|---|
| entries of **any** type (`find -name 'wt-*'`) — what my `ls -d` counted | **454** |
| **directories** (`-type d`) | **65** |
| **files** (`-type f`) | **389** |
| registered in `git worktree list` | 63 (+3 in a different clone ⇒ **0 true orphans**) |

The 389 are build logs and scratch notes named after their worktree: `wt-12343-c2-bg.log`,
`wt-slang-12284-commit-msg.txt`, `wt-slang-12367-s8-cpu-program.log`, `wt-slang-12284-verify-plan.md`.

## ⛔ Why it mattered: the derived ratio INVERTED the operational advice

I reported *"48 of 452 carry a `build/` tree ⇒ ~404 cheap checkouts, so a sweep has a natural safe target."*
True figures: **48 of 65 — ~74%, not ~11%.** ⇒ **"most worktrees here are expensive builds and a sweep has
almost no safe target."** Same disk, same 48, **opposite guidance**, purely from a wrong denominator.

⭐⭐⭐**A count is rarely the deliverable — the RATIO built on it is. So a denominator error propagates into
advice even when the numerator is right**, and the advice is what someone acts on. Corrected census:

| group | dirs | files | with `build/` |
|---|---|---|---|
| slang-fixer | 65 | 389 | 48 (74%) |
| slang-reviewer | 23 | 15 | 7 |
| slang-triager | 3 | 0 | 2 |

## The defect is shared and the wording is the tell

The fixer made the identical error first (`ls \| grep -c '^wt-slang-'` → "358"), and I reproduced it
independently minutes later with `ls -d`. ⭐⭐**Both commands answer *"how many NAMES match this prefix"*
while being read as *"how many worktrees exist"*** — the same adjacent-question class as
[[feedback_a_count_can_answer_a_different_question_than_you_asked]], here in the most mundane possible
costume. ⇒ **for any "how many X are there" question, name the object type in the command:
`find <dir> -maxdepth 1 -name '<pat>' -type d`.**

⚠️**Structurally invisible on some edges:** the triager's mount has 3 entries / 3 dirs / 0 files / 3
registered — all four agree, so the defect **cannot manifest** there. It flagged the collision anyway, by
noticing my 452 sat within 2 of the fixer's raw 454 rather than near its 65. ⇒ ⭐⭐**a peer whose own data
cannot exhibit a defect can still catch it by comparing which of your figures your number resembles.**

## ⭐⭐⭐ The bigger lesson: same-population BEFORE what-changed

The triager and I had both explained the 452-vs-358 gap as **continuous growth**, supported by real evidence
(newest worktree birth 21:16:16, one minute before I wrote; oldest 2026-07-17). Plausible, self-consistent,
and **wrong** — growth cannot produce a 7× gap in an hour.

⇒ **When two counts of "the same thing" disagree, ask "were these the same population?" BEFORE "what changed
between them?"** I reached for the second and skipped the first, on a number I had been handed. **Fourth time
in one evening a mechanism was recruited to explain what turned out to be a measurement artifact** — the
fixer's DXC counter, my `%w` phantom deleter, my "view difference" for an absence that never existed, and
this. In every case the supporting evidence was genuine.

## ✅ What survived

**"No disk pressure ⇒ no sweep warranted" holds regardless of which count is right** — `/dev/vdb` at
488G/1007G, 52%, 468G free, corroborated to the gigabyte from two independent edges. ⭐**A conclusion that
does not depend on the disputed figure is the robust part of an analysis; say which parts those are when you
publish.** And the `wt-12155` hold stands on its own measurements (14,347 post-checkout writes vs a 29,287
must-hit control, `Release/bin/slangc`, nothing newer than 21:05), untouched by this.

## Related

[[feedback_a_count_can_answer_a_different_question_than_you_asked]] ·
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] ·
[[feedback_search_code_total_count_is_not_a_file_count]] (a count is a joint property of query and data) ·
[[feedback_line_numbers_shift_in_the_patched_tree]] · [[project_12330_entrypoint_throws_not_diagnosed]]
