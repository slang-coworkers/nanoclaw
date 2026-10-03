---
name: project_12405_peephole_fp_mode_unreachable_and_leaks
description: "#12405 slang peephole Add/Sub float zero-fold ungated. Two defects, one root cause (Main-verified at d7d59f374): the pass NEVER reads -fp-mode, and autodiff's Fast leaks module-wide via the fixpoint loop. Maintainer confirmed both bugs 08-06; fix = draft PR #12713 (fix/issue-12405, opened 08-24, still draft/open 10-02)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 2861fef4-d207-4f49-a66d-1fde7cb32722
---

# #12405 — peephole fp-mode is unreachable from the CLI, and autodiff's `Fast` leaks

Filed 2026-08-06 17:36Z by our own `nv-slang-bot[bot]` (a sibling slang-triager session, as a spin-off
of #12396). Title: the `Add`/`Sub` additive-identity float fold is not gated on
`allowUnsafeOptimizations`, while the adjacent `Mul`/`Div` zero folds are. Labels `bug` + `reproduced`,
Type `Bug`, assignee `jkwak-work`, milestone Q3 2026.

## State (re-verified live 2026-10-02)

- **Maintainer verdict 2026-08-06, jkwak-work, cmt `5363875868`:** *"I think both are unintended bugs.
  For Q1, allowUnsafeOptimizations should be also applied to Add/Sub; please leave comments in the code
  that explains why it should be applied. For Q2, let's apply `-fp-mode`."* ⇒ the Q1 **in-code comment
  is a deliverable** (PR acceptance criterion), not optional.
- Handoff 2026-08-21: Main → `slang-triager` (pinned to its existing 12405 session
  `sess-1786038083166-nu4qd4`) → fixer, with the single-fix brief below. Triager comment `5363936441`.
- **Fix = draft PR #12713** (`fix/issue-12405`, nv-slang-bot, opened 2026-08-24, *"gate float
  additive/zero identity folds on fp-mode, resolve mode per-inst"*). Still **OPEN + DRAFT** and the
  issue still open as of 2026-10-02. PR events route to the fixer via the PR mapping; nothing owed from
  Main unless a human comment lands on the issue.
- PR #12417 (merged, the #12396 fix) is a *different* change that deliberately left this fold alone.

**RESUME triggers:** PR #12713 review/merge events; any fresh substantive human comment; and
(catch-all) any inbound that adds an *obligation* or changes *scope* (revert, follow-up issue, doc
mirror), not only ones that change the answer — the clause-D pattern from
[[project_12364_cts_storage_image_minnonuniform]].

## Root cause — one state-carrying member, two defects

Anchors at `de679fdc3` (the triager re-verified these; `d7d59f374` numbers are stale): ungated
`Add`/`Sub` `isZero` folds `slang-ir-peephole.cpp:205/209/216/220` (the Q1 comment site);
`floatingPointMode` member `:21`; fixpoint loop `:2033-2056`; `getParentFunc` `slang-ir.h:2494`;
`getFloatingPointMode` `slang-compiler-options.h:395`; reference pattern `isFloatingPointModePrecise`
`slang-emit-spirv.cpp:10414`.

**Defect A — the pass never reads `-fp-mode`.** `PeepholeContext::floatingPointMode` defaults to
`Precise` and has exactly three occurrences (decl, one read, one write); there is no
`getOptionSet().getFloatingPointMode()` call in the file, so `-fp-mode fast` vs `precise` is
byte-identical **by construction** (the filed body's "inconclusive probe" was measuring a variable with
no path to the gate). The sole writer reads `IRFloatingPointModeOverrideDecoration`, whose only producer
tree-wide is `slang-ir-autodiff-fwd.cpp` `translateFuncHeader`, always `Fast` ⇒ unsafe float folds only
ever fire inside forward-mode autodiff functions.

**Defect B — `Fast` leaks module-wide.** `processInst` sets the mode on a decorated function and has no
else-branch resetting it, while `processChildInsts` is one flat LIFO worklist walk (not per-function
recursion). ⭐⭐⭐ The triager's decisive refinement: the **fixpoint loop re-runs the walk while the
member survives across iterations**, so iteration 2 starts in `Fast` and *every* function folds —
including ones declared before the autodiff one, which a within-walk story cannot explain. ⛔ Adding
`floatingPointMode` to `processFunc`'s save/restore is a **no-op**: in the module path `processFunc` is
called exactly once, on the module inst. The per-func entry `peepholeOptimize(target, func)` builds a
fresh context and does not leak.

⇒ **Principled single fix:** delete the member and resolve per inst like `isFloatingPointModePrecise`
(global option as base, parent-function decoration override on top). Fixes A (option finally consulted)
and B (stateless) by construction. ⛔ The tempting else-branch reset stops the leak but leaves
`-fp-mode` unreachable — a fixer would measure "leak gone" and declare victory on the wrong headline.

⚠️ **Scope consequence:** making `-fp-mode fast` reach the gate **newly enables the `Mul`/`Div` zero
folds for all user fast-math code** — expect baseline churn; needs two-sided regression tests and a
build + `slang-test` run. Triager's sweep found no in-tree test depending on the ungated behaviour (0
zero-literal `CHECK-NOT`s against a 443-line must-hit control; 913 baselines clean), with the right
caveat: *"no test depends on it" ≠ "no test breaks"*.

⚠️ Labels are `bug` + `reproduced` because the repo has no IR/optimization label — borrowing a target
label for a target-independent defect would be worse. Not a missed label.

## Process lessons surfaced here (filed in their own concepts)

- A mechanism that reproduces the *direction* of an effect can miss its *coordinates* (the
  first-declared function folding too) — [[feedback_mechanism_must_predict_observed_coordinates]].
- I briefed "no Issue Type" with no instrument that could see the Type field (MCP returns none); it was
  already `Bug`. A capability/absence negative — [[feedback_published_negative_env_claims_need_rederivation]].
- I credited the triager for a body restructure a *different* session wrote under the shared bot
  identity — [[feedback_a_shared_bot_identity_makes_authorship_unattributable_from_github]].
- A summarized grep result described from expectation — [[feedback_i_described_grep_output_from_expectation_not_from_reading_it]].
- The triager reported the shared slang clone acquiring 3 foreign tracked mods mid-session; my edge
  (`groups/main`, 0 mods) was a different mount — both reports true about different objects, don't
  "disprove" one with the other ([[feedback_group_clone_is_shared_by_all_sibling_sessions]]).
