---
title: "slang switch #12239 — reject nested case labels in validateCaseStmts, but STOP recursion at inner SwitchStmt"
type: learning
topic: slang-compiler
source: learnings/1785176804780-slang-switch-12239-reject-nested-case-labels-in-va.md
---

# slang switch #12239 — reject nested case labels in validateCaseStmts, but STOP recursion at inner SwitchStmt

Planning #12239 (case/default nested in a block or `if` escapes uniqueness diagnostics + ICEs on case-in-if). Root cause verified @70462843c: `validateCaseStmts` (slang-check-stmt.cpp:360-399) scans ONLY direct children of the switch body SeqStmt (`:372`), while `lowerSwitchCases` (slang-lower-to-ir.cpp:9221-9324) RECURSES through BlockStmt/SeqStmt — so nested-in-block dup labels are hoisted into IR but never uniqueness-checked; and a `case` inside an `if` isn't collected by lowering (it doesn't unwrap IfStmt), routes to `visitCaseStmtBase` (:8077-8079) → SLANG_UNEXPECTED E99997.

Recommended fix = Approach A (producer-side): make `validateCaseStmts` recurse and emit a NEW 306xx error for any case/default that is not a direct child of the switch body. Matches documented Slang rule (case/default MUST be directly under switch; Duff's device disallowed — confirmed via DeepWiki).

**KEY REFINEMENT the triage memo didn't spell out:** the recursion must STOP at a nested `SwitchStmt` boundary. A `case` inside an inner `switch` is legal and belongs to that inner switch (tests: bugs/nested-switch.slang, language-feature/switch-fallthrough/fallthrough-nested-switch.slang, multi-level-break-switch.slang all use legal inner switches at deeper indentation). `lowerSwitchCases` already gets this right — an inner SwitchStmt is not a BlockStmt/SeqStmt so it falls to the ordinary-stmt `else` and isn't recursed. Mirror that stop condition or you false-positive on every nested switch.

**Diag numbering:** 306xx switch block holds only switch-multiple-default=30602 and switch-duplicate-cases=30605. 30601/30603/30604 are VISIBILITY errors elsewhere (not switch). Next free switch numbers = 30606/30607. ⚠ #12238 (float switch) also eyes 30606 → first-to-ship claims it; re-grep at implement time.

**Label:** turning previously-accepted (miscompiled) code into a compile error is a language tightening → likely `pr: breaking change`; confirm with maintainer.

**Gotcha:** `__target_switch`/`__stage_switch` cases are a DIFFERENT AST node (TargetCaseStmt), separate validation path (visitTargetSwitchStmt) — do NOT touch. Also DeepWiki hallucinated conformance-test filenames (switch-case-outside-switch-rejected.slang) that don't exist in-tree — verify any cited test path with `find` before relying on it.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785176804780-slang-switch-12239-reject-nested-case-labels-in-va.md`_
