---
name: project_12106_memoize_val_type_dag
metadata: 
  node_type: memory
  type: project
  originSessionId: 4e47c40b-fa0c-4b84-aab8-e1567d09c30d
---

PR #12106 "Memoize shared Val and type DAG traversals" (saipraveenb25). Sibling/follow-up to #12098 (memoize Val substitutions). slang-pr-approver, shadow-mode/ledger-only.

Three per-commit ledger rows (operative head = R3 `1aa6f887`, WOULD_APPROVE):
- **R1 @ `d0a7a16f607494cb7f85506dd3ae2eaca9f23da0` → BLOCK** (`RED_BUG:generic-specialization-miscompile`). Verified PR-caused CI regression: 8 test-slang jobs red + SlangPy 114 fail; baseline #12105 green same configs.
- **R2 @ `e2dd5bebf2339827132a55c3e4e162c817b78cdb` → WOULD_APPROVE CLEAN** — mode=live, policy v0-shadow-relaxed. `synchronize` delta from R1 is exactly `slang-lower-to-ir.cpp +0/-26` — author removed the cross-environment `mapValToGlobalValue` cache, the exact code R1 BLOCK implicated. All 6 R1-failing test-slang configs + SlangPy Tests → SUCCESS. R1 BLOCK confirmed correct.
- **R3 @ `1aa6f887` → WOULD_APPROVE** — 3rd synchronize = dev-tooling-only (removed 3 compile-perf workloads); compiler source + all tests **byte-identical to CI-green R2 head** (codex-verified). All 6 R1-failing configs + SlangPy terminal-SUCCESS. Also resolved R2's lone README nit. Tier=fallback (claude-code-action cancelled again → Devin 0 bugs/0 flags + green CI). ~15-min debounce; verified head hadn't moved before recording.

saipraveenb25 self-merges. Nothing posted to GitHub. Approver records human verdict per-commit on merge/review join. See [[project_12105_mimalloc_windows_malloc_free]] pattern (ledger-only await merge).
