---
name: project_11877_operator_overload_fastpath
metadata: 
  node_type: memory
  type: project
  originSessionId: 8a8a12da-1dd6-48d9-ab11-aec7ef0d4c0b
---

**shader-slang/slang#11877** — a user-defined global `operator OP` whose params are builtin scalar/vector/matrix types (e.g. `float4x4 operator*`) is **silently dropped** since v2026.11: `a*b` resolves to the builtin component-wise multiply, overload never called, no diagnostic. Genuine high-severity silent correctness regression.

**First-bad = #11493** (`61ad43dbc`, "Hard-code a fast path for builtin scalar/vector/matrix operators"), confirmed by fresh symbol-checked GOOD→BAD builds (parent `956f6ed52` honors → #11493 drops). Issue's own attribution to #11493 turned out ACCURATE; triager's interim "predates #11493" call was WRONG — fooled by slangc's cached CMake version string (see shared learning "Slang bisect: don't trust slangc's version string"). Mechanism: `visitInvokeExpr` (slang-check-expr.cpp:5007→5008) returns the `BuiltinOperatorExpr` fast path BEFORE overload resolution at :5044; only matrix deferral is GLSL-scope-gated (:4723-4733). Target-independent (front-end drop before emit).

**Fix: PR #11879** (`fix/issue-11877`, `Closes #11877`, `pr: non-breaking`). Approach A: new `hasUserDefinedNonCoreOperatorInScope` does existence-only scoped `lookUp` filtered `!isFromCoreModule`, defers to real overload resolution on any user candidate; applied at binary+unary fast-path sites, mirrors GLSL-scope deferral. No-overload common case stays cheap (preserves #11493's perf intent). Regression test `builtin-operator-user-overload-11877.slang` (CPU COMPARE_COMPUTE + HLSL/SPIR-V emit checks).

**State (2026-07-02):** **jkwak-work (maintainer) flipped to ready-for-review** 23:06Z — bot never readied it, drafts-only gate INTACT. `reviewDecision=REVIEW_REQUIRED` (no formal approval), `mergeable=true` but `mergeable_state=behind` (needs rebase onto master before merge). Labels `Office-Yong`/`Office-Tess`. jkwak soft-positive but deferred to office-hours: unsure how name-resolve works at AST stage. Open design point = per-expr scoped lookup vs. memoized per-`Linkage` "any user operator exists" fast-reject flag (perf vs #11493's skip-resolution intent), likely for @skiminki-nv. Verdict posted issuecomment-4852879346; fixer PR reply 4871193089.

**Chain closed our end.** Re-engages via webhook (office-hours/review input or CI) → routes to slang-fixer session via pr_session_mapping. Merge is maintainer-gated (no bot merge/ready/auto-close). Don't re-triage; don't nudge before office-hours input lands.
