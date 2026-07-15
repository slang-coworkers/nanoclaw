---
name: project_12106_memoize_val_type_dag
metadata: 
  node_type: memory
  type: project
  originSessionId: 4e47c40b-fa0c-4b84-aab8-e1567d09c30d
---

PR #12106 "Memoize shared Val and type DAG traversals" (saipraveenb25). Sibling/follow-up to #12098 (memoize Val substitutions). slang-pr-approver, shadow-mode/ledger-only.

Two per-commit ledger rows:
- **R1 @ `d0a7a16f607494cb7f85506dd3ae2eaca9f23da0` → BLOCK** (`RED_BUG:generic-specialization-miscompile`). Verified PR-caused CI regression: 8 test-slang jobs red + SlangPy 114 fail; baseline #12105 green same configs.
- **R2 @ `e2dd5bebf2339827132a55c3e4e162c817b78cdb` → WOULD_APPROVE CLEAN** — mode=live, policy v0-shadow-relaxed. Current settled head (no push since 01:09:59Z), operative decision (recorded 02:18Z).

Why R2 flips clean: `synchronize` delta from R1 is exactly `slang-lower-to-ir.cpp +0/-26` — author removed the cross-environment `mapValToGlobalValue` cache, the exact code R1 BLOCK implicated. All 6 R1-failing test-slang configs + SlangPy Tests → SUCCESS on `e2dd5be`. So R1 BLOCK confirmed correct; R2 clean. 6/6 clauses pass. Tier=fallback (claude-code-action run cancelled → Devin exit 0, 0 bugs). One advisory doc nit (README missing `val_substitution_dag` compile-perf row) → cleared.

saipraveenb25 self-merges. Nothing posted to GitHub. Approver records human verdict per-commit on merge/review join. See [[project_12105_mimalloc_windows_malloc_free]] pattern (ledger-only await merge).
