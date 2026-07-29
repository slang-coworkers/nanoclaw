---
name: project-12238-float-switch-condition-invalid-spirv
description: "slang#12238 — non-integral (float) switch condition accepted → invalid SPIR-V (E99999); Approach A (reject/E30607) SHIPPED draft PR #12246; review dispatched; merge operator-gated"
metadata: 
  node_type: memory
  type: project
  originSessionId: a85f5681-dc13-4c7e-9900-af66e4a8d19f
---

shader-slang/slang#12238 — "Non-integral (float) switch condition is accepted and produces invalid SPIR-V". Author **skiminki-nv** (NVIDIA member; Issue Type `Language Maturity` human-set; label `Dev Opened`). Triaged 2026-07-27, REPRO @HEAD `70462843c`. bug/**P2**; frontend sema type-check gap → invalid codegen (cross-target).

**Bug:** front-end ACCEPTS float-typed `switch` condition; only emits `warning[E30081]` (on the case label, not the condition), then lowers an inconsistent IR `switch(%f: Float, ... 1: Int)` — float selector + int labels. On `-target spirv` → invalid `OpSwitch` (selector not scalar int) → SPIR-V validation fail → `internal error[E99999]`. **NOT SPIR-V-specific:** GLSL/CUDA/C++ also emit `switch(float(...))` (invalid); SPIR-V just catches it. Reporter wants a **type error** at the switch.

**Root:** `SemanticsStmtVisitor::visitSwitchStmt` `source/slang/slang-check-stmt.cpp:406-407` — `// TODO(tfoley): need to coerce condition to an integral type...`; condition only `CheckExpr`'d, never coerced/validated to integral. Case labels ARE coerced to condition type + `checkConstantIntVal` in `visitCaseStmt` (:414-443, warning fires here). No "switch condition must be integral" diagnostic exists.

**DESIGN-FORK (maintainer pick required) — mirrors [[project-9999-switch-without-cases-diagnostic-fork]] E30606-vs-E41000:**
- **A (reject, reporter's pref):** new type-error diag at :406-407 if condition non-integral. Fastest correct fix; kills invalid codegen on all targets; clean diag replaces E99999. Potential **breaking change** for HLSL-legacy implicit float→int switch (no *working* SPIR-V broken — already E99999 today). Must scope "integral" to include enum.
- **B (coerce, resolves TODO / matches HLSL):** coerce condition to int at :407. Non-breaking, valid codegen. But silent float truncation; does NOT satisfy reporter's stated expectation.
- **C (codegen legalize selector):** REJECTED — wrong layer (consumer-side patch of malformed front-end IR; per-backend/incomplete).

**Sibling [[project-12236-switch-pre-case-unreachable]] cluster context — NOT a dup:**
- **#12237 (closest sibling, same author):** "Boolean switch condition asserts during SPIRV emission." Non-integral selector too, but bool ABORTS in emission (lossless→accept natural) vs float PASSES THROUGH to invalid OpSwitch (lossy→reporter wants reject). Distinct roots, likely-different resolutions. **Shared-root opportunity:** resolving `TODO(tfoley)` at visitSwitchStmt:406 (enforce "condition must be integral") is one policy point covering BOTH — flag to maintainer as unifying, keep issues separate.
- #9999 / #12236 (switch missing-diag): DIFFERENT root (`lowerSwitchCases()`). Not this bug. #12222 (lexer): unrelated.

**E30606 collision — RESOLVED 07-27:** #9999 keeps **E30606** (jhelferty fork); #12238 takes **E30607** (triager re-verified 30600–30605 taken at HEAD `f282bdf9c`). No renumber pending.

**State:** ~~triaged → DESIGN-FORK → HELD~~ → **UNPARKED 07-27**. Verdict posted (issue comment **5094909101**), `reproduced` applied.

**DECISION 07-27 — maintainer jkwak-work: "@nv-slang-bot Make a PR ... an error is expected. Let's go with A (reject)" (comment 5097226951).** Design-fork RESOLVED → **Approach A** (aligns with reporter skiminki-nv's stated preference; two members aligned). Explicit "make a PR" = gate released. Routed via slang-triager (dispatch-owner of fixer) → slang-fixer to IMPLEMENT A on canonical thread `gh-issue-shader-slang/slang-12238`; `<github-post-authorized />` (jkwak-work @-mentioned bot).

**Implement-A brief given to fixer:**
- New type-error diag in `visitSwitchStmt` (`slang-check-stmt.cpp:406-407`), after `CheckExpr`, when condition type non-integral → error; add to `slang-diagnostics.lua`.
- ⚠ **E30606 collision RESOLVED — #12238 uses E30607.** Triager re-verified at HEAD `f282bdf9c`: 30600–30605 taken; **E30606 reserved for #9999** (jhelferty fork), **E30607 = #12238's new "switch condition must be integer" error**. (The original triage-memo "E30606 switch-multiple-default / E30607 switch-duplicate-cases existing" line was DeepWiki-sourced/imprecise; the HEAD grep supersedes it.)
- Scope "integral" to include enum. **Coordinate w/ #12237 (bool):** bool is handled by legalization (ACCEPT→int in processSwitch), so A's reject predicate must target non-integer (float etc.), NOT clobber #12237's bool path.
- Potential breaking change — maintainer signed off; label per convention; note no *working* SPIR-V broken (already E99999).
- Test CAN exist here (expected-diagnostic `.slang` test), unlike build-only #12234. Draft PR `Fixes #12238` + 5-bullet; branch `fix/issue-12238`; report_pr_created; merge OPERATOR-gated.

**DRAFT PR #12246 OPEN + VERIFIED 07-28** — "Reject non-integer switch condition (#12238)", author nv-slang-bot, branch `fix/issue-12238`, `Closes #12238`, label `pr: breaking change`. New diag **E30607** (`switch-condition-not-integer`) + early-reject in `visitSwitchStmt` (`slang-check-stmt.cpp:407`) via `isValidCompileTimeConstantType` — float rejected; int/enum accepted; bool left to #12237; resolves `TODO(tfoley)`. Fixer internal review clean (enum false-positive refuted empirically; ErrorType guard confirmed; 2 minor nits handled). Tests: new expected-diag test PASS; `tests/diagnostics` 707/707, enums 38/38, switch 74/74, zero regressions. Out-of-scope note: `uint64_t` switch hits pre-existing #12240 (cited, not acted on). GitHub verdict refreshed (fresh delta comment **5098768205**). **State: chain terminal-HELD at draft-PR-open; merge OPERATOR-gated (no auto-merge).** Reviewer verdict routes to fixer (≤2 REQUEST_CHANGES rounds); triager re-reads merged diff + forwards final resolution on merge.

**➡️ 2026-07-28 08:09 — NON-DRAFT + csyonghe sign-off gate (fixer msg 70760).** skiminki-nv commented on #12246: *"Since this is a language change, we'll need @csyonghe's sign-off."* — substantive routing, NOT a code-change request. **PR flipped non-draft by a maintainer** (bot did NOT flip — drafts-only gate honored); `reviewDecision=REVIEW_REQUIRED`. Fixer posted a tight orientation comment (reject-approach; scope float-rejected / bool→#12237 / uint64→#12240; breaking label; tests green), did NOT request @csyonghe as reviewer (no pre-request rule), did NOT flip/merge, did NOT dispatch CI (non-draft auto-runs the `pull_request` path). **Blocker = csyonghe language-change sign-off (external, no Main/fixer action).** Awaiting csyonghe + the slang-reviewer verdict Main forwarded (msg 70720→70742-thread). Fixer holds; drives REQUEST_CHANGES per max-2-round if findings land, else holds for maintainer approval + human merge. Merge OPERATOR/maintainer-gated.

**✅ 2026-07-28 01:16 — Approach A SHIPPED, draft PR #12246 (fixer msgs 70718/70720).** Head `f3b5b51188`, base master, rebased onto `15863db482`, `pr: breaking change` labeled. 3 files +40/−1: `visitSwitchStmt` (slang-check-stmt.cpp) rejects a non-integer/enum condition via `isValidCompileTimeConstantType` → **new error E30607** + early return (removes the stale `TODO(tfoley)`); diagnostic def registered at 30607 (per the #9999→30606 reservation); new diagnostic test `tests/diagnostics/switch-non-integral-condition.slang`. **Coordination verified as briefed:** bool left unchanged (still #12237's E99997 path), enum accepted, float rejected; generic-enum switch 3/3; undefined-cond → only E30015 (ErrorType guard). uint64 = separate pre-existing #12240 (out of scope, referenced in PR). **Tests:** new repro PASS; `tests/diagnostics` 707/707, enums 38/38, switch 74/74 — zero regressions. codex CODE+PLAN+OUTPUT all APPROVE. Maintainers jkwak-work + skiminki-nv approved Approach A. **NOT merged/flipped (operator-gated).** Fixer relayed a review request through Main (no reliable reviewer edge) → **forwarded to slang-reviewer** on canonical thread `gh-issue-shader-slang/slang-12238`. Terminal-pending: reviewer verdict → fixer handles REQUEST_CHANGES per max-2-round; then human/maintainer merge.
