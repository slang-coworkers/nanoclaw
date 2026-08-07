---
name: feedback_a_positive_marker_beats_an_absence_in_a_log
description: "To prove WHICH of two versions of a file a build read, find a token unique to one of them in the log — an absence proves nothing about a log that might not enumerate at all. Measured on nanoclaw#1122 2026-08-06."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 73bc7a6b-93b3-4779-bd6e-12f696b8d2a9
---

# To prove *which* input a build read, look for a marker unique to one — not for the absence of the other

Measured 2026-08-06 on `slang-coworkers/nanoclaw#1122`.

**The question.** A PR adds a dependency to `package.json`, but that file is owned by a different
branch and CI merges the owner's copy over it. Did the green CI install the PR's dependency or the
owner's manifest?

**The weak evidence I reached for first:** `grep ccusage <install log>` → **0 hits**. That is nearly
worthless on its own, because a `0` is consistent with three different worlds: the dep wasn't
installed · it *was* installed but the log doesn't name individual packages · my pattern is wrong.

**Strengthening step 1 — establish the log enumerates at all, with controls.** `better-sqlite3` → 4
hits, `cron-parser` → 1, `kleur` → 1, and the section reads `+ <name> <version>` per package, 25 of
them. **Now** the zero means something: this log names top-level packages, and ccusage isn't among
them.

**Strengthening step 2 — ⭐⭐⭐ find a token that exists in ONLY ONE candidate input.** The list
included **`@chat-adapter/telegram 4.29.0`**, which is present in the owner branch's `package.json`
and **absent from the PR branch's** (verified: `grep -c` → 1 vs 0). That single line converts
"we didn't see X" into "**we positively saw a marker that only the other manifest carries**" — a
claim about which file was read, not about what a grep failed to find.

## The rule

**An absence answers "was X there?"; a unique positive marker answers "which input was this?"** When
the question is *which of two versions was used*, diff the two candidates for a token exclusive to
one and hunt for **that**. It is one extra command and it upgrades a suggestive zero into a direct
observation.

Corollary already in this store: pair every absence claim with a control that could return the other
answer ([[feedback_audit_grep_false_negatives_asymmetric]]). This adds the next step — once the
instrument is proven, prefer the **presence** of a discriminating marker to the absence of the thing
you expect missing.

Related: [[project_nanoclaw_1122_ccusage_pin_owned_file]],
[[feedback_a_ci_step_added_on_a_parent_branch_does_not_compose]].
