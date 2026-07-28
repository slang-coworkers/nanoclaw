---
name: project_12239_switch_case_nested_block_uniqueness
description: "slang#12239 — case labels nested in blocks/if escape switch uniqueness diagnostics; distinct from"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8f5bd6a1-b914-4421-a088-a8bd564cdbba
---

# slang#12239 — case labels in nested blocks escape switch uniqueness diagnostics

**Filed** 2026-07-27 by **skiminki-nv** (MEMBER; self-files + self-defers the switch-diagnostic series). bug / **medium** / **P2** / frontend semantic-checker + IR-lowering. Triaged + VERIFIED @HEAD `70462843c` (compile-path, no GPU). Verdict posted **comment 5095052154**; `reproduced` label applied.

**Two facets, both reproduced:**
- **Facet 1** — `case` nested in a `{ }` block duplicating a sibling label → duplicate `case int(0):` emitted in HLSL, **exit 0, NO Slang diagnostic** (silent wrong-code; DXC rejects the dup).
- **Facet 2** — `case` inside an `if` → **E99997 ICE** (`SLANG_UNEXPECTED "case/default not under switch"`), exit 255.

**Root cause — traversal-depth mismatch (DISTINCT root SITE from the rest of the family):**
- `validateCaseStmts` (slang-check-stmt.cpp:360-399) scans ONLY direct children of the switch body → nested dup never reaches the uniqueness HashSet (E30605 never fires).
- `lowerSwitchCases` (slang-lower-to-ir.cpp:9221-9324) RECURSES BlockStmt/SeqStmt and hoists the nested arm anyway, but does NOT unwrap `IfStmt` → case-in-if reaches `visitCaseStmtBase` (:8077-8079) → the ICE.

**Recommended fix = Approach A** — make `validateCaseStmts` recurse and REJECT any case/default not directly under the switch body with a new 306xx diagnostic; producer-side (checker) fix closes BOTH facets, matches documented rule + reporter's expected behavior. (B: implement lowering's "general case" TODO — over-scoped, rejected. C: guard the ICE assert only — band-aid, pair with A at most.)

**Status: RESUMED 2026-07-27 21:52:59Z** — maintainer **jkwak-work** commented `@nv-slang-bot Make a PR` (comment 5097218572; verified). Hold released; slang-fixer dispatched Approach A with `<github-post-authorized />`. Draft/HELD posture per drafts-only guardrail; PR to carry 5-bullet + `Fixes #12239` + `report_pr_created`. Awaiting fixer [Fix Report] + PR number.

**Fixer-plan refinements folded in:** stop recursion at nested `SwitchStmt`; proposed diag# 30606/30607 — ⚠ E30606 contention with #9999/#12238; don't touch `TargetCaseStmt`; likely `pr: breaking change`.

Not a dup of [[project_9999_switch_without_cases_diagnostic_fork]].

Switch-diagnostic family (all distinct root sites): #9999 (`lowerSwitchCases` :9305 pre-label drop) · [[project_12236_switch_pre_case_unreachable]] (dedup→#9999) · [[project_12237_bool_switch_spirv_assert]] (`processSwitch`) · #12238 (condition coercion) · #12239 (this — `validateCaseStmts` scan depth + `IfStmt` unwrap gap).
