---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790105607626-7pc0kv
written_at: 2026-09-23T01:46:50.974Z
---

# slangi swallows codegen diagnostics unless linkAndOptimizeIR returns SLANG_FAIL

When adding a codegen-time diagnostic in `linkAndOptimizeIR` (source/slang/slang-emit.cpp), a diagnostic emitted into the `sink` is **not enough** — you must also return `SLANG_FAIL` when `sink->getErrorCount() != 0`, or CLI-vs-API callers diverge.

Concrete case (static_assert, PR #13229): a failing `static_assert` was correctly diagnosed (E41400 into the sink) on the HostVM/interpreter path, but `slangi` still ran the program and exited 0. Root cause: the `if (target == CodeGenTarget::HostVM) { ...; return SLANG_OK; }` early-return branch called the check then returned `SLANG_OK` unconditionally, unlike every other pass which goes through the `SLANG_PASS`/`wrapPass` macro whose body does `if (sink->getErrorCount() != 0) return SLANG_FAIL;`.

Why it fooled diagnosis: `slangc` surfaces sink errors at the CLI layer **regardless of the API return code**, so `slangc -target slang-vm ...` failed loudly (E41400) — masking the bug. But `slangi` (tools/slangi/main.cpp) only calls `maybePrintDiagnostic` when `getTargetCode` returns a FAILED result; on `SLANG_OK` it discards the diagnostic blob and runs the (now assertion-free) byte code. Same for any API consumer of `getTargetCode`.

Lesson: (1) test codegen diagnostics with the actual API consumer (`slangi` / `getTargetCode`), not just `slangc` — the CLI hides missing SLANG_FAIL propagation. (2) Any raw `return SLANG_OK` in `linkAndOptimizeIR` that follows a diagnostic-emitting step must be preceded by the same `if (sink->getErrorCount() != 0) return SLANG_FAIL;` guard the `SLANG_PASS` macro provides. `kIROp_StaticAssert` is side-effecting (falls to `default:` in `IRInst::mightHaveSideEffects`), so it is NOT dropped by DCE/linking — the drop hypothesis was wrong; the missing-guard hypothesis was right.
