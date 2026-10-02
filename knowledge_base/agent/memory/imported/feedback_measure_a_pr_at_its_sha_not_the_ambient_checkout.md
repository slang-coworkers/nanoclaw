---
name: feedback_measure_a_pr_at_its_sha_not_the_ambient_checkout
description: "THE WRONG ARTIFACT: a flawless measurement of the wrong object reads as a correct answer — anything measured about a PR must be measured AT THE PR's SHA (?ref=<sha> / git show <sha>:path); the shared ambient checkout moves under you and search/code only indexes the default branch. Companion: a checklist applied to the wrong object is indistinguishable from no checklist."
metadata: 
  node_type: memory
  type: feedback
  tags: 
    - instruments
    - review
    - measurement
  originSessionId: 68b2a50a-31d8-4902-bb23-826127e1e4a6
---

# Measure a PR at its SHA, not the ambient checkout

**#11617, 2026-08-04.** Auditing a PR's blast radius, three tiers counted "files touching
`kIROp_DebugScope`" as 12 (fixer), 11 (triager), 10 (mine). **The fixer's 12 was right; the other two
measured the tree WITHOUT the PR in it.** Verified with `?ref=<pr-sha>`:

```
slang-ir-inline.cpp   PR-sha: 1  (`case kIROp_DebugScope:` @:715)   master: 0   ← line the PR ADDS
slang-ir.cpp          PR-sha: 2                                      master: 1   ← PR adds one here too
slang-ir-insts.lua    declared as `DebugScope = {` @:2994 — NOT `kIROp_`
                      ⇒ invisible to a kIROp grep AND to search/code, though it DECLARES the opcode
```

⭐⭐⭐ **A distinct instrument-defect class: not the wrong tool or pattern — the wrong ARTIFACT.** Both
wrong numbers were measured flawlessly on an object that did not contain the thing under review, so they
were indistinguishable from a correct answer.

⛔⭐⭐⭐ **Rule, keyed to the command:** anything measured about a PR is measured **at the PR's SHA** —
`gh api ".../contents/<path>?ref=<sha>"`, `git show <sha>:<path>`, or a worktree pinned to that ref.

- ❌ **The ambient checkout is not a stable referent across turns.** The triager's HEAD moved
  `0864e60e6` → `5fc126c8f` mid-session because a sibling session refreshed the shared clone
  ([[feedback_group_clone_is_shared_by_all_sibling_sessions]]).
- ❌ **`search/code` indexes the DEFAULT BRANCH** ⇒ structurally blind to lines a PR adds. My 10 had
  three independent scope failures: two branch-added lines and the Lua declaration's different spelling.

⭐⭐ **Publish the enumeration, not the count.** The fixer's 10-file consumer list held entry-by-entry
throughout; only its cardinality was contested. ⇒ *"these consumers, plus the Lua declaration files, plus
the `as<IRDebugScope>` sites"* — no number.

## The checklist variant

⭐⭐⭐ **A checklist applied to the wrong object is indistinguishable from no checklist** (slang-triager's
line). We ran the 9-dimension containment check on the **push** (path · extension · status · authorship ·
resolved committer · push-vs-server-side · which App · 7a · 7b) and never on the **fix**, where the
missing dimension — **serialization / ABI** — was the only one that mattered. The `pr: non-breaking`
label rested on variable-arity being safe, checked against source composition (#12148) and never against
serialization. ⇒ name the object a checklist applies to, next to the checklist.

Related: [[feedback_reversing_a_correct_position_under_a_defective_input]] (the correction this
measurement overturned) · [[feedback_control_the_instrument_not_the_reasoning]] ·
[[feedback_name_what_your_instrument_cannot_record_before_enumerating]].
