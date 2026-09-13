---
name: project_11951_testserver_jsonrpc_pathlevel_flake
description: "✅✅ FULLY RESOLVED #11951 Sig-B test-server JSON-RPC IPC-drop flake — TRUE cause = JIT-teardown UAF, fixed by #12114 (bf7a78ab25f4, merged 07-15 21:40Z); #12056/AVX-512 was incidental. Fix-gap flag was real but mis-attributed; post-#12114 trees show discriminator NONE; loop closed cmt 5007190490."
metadata: 
  node_type: memory
  type: project
  originSessionId: ddab6188-0f28-4222-8b37-6ae1cbb4b414
---

# ✅✅ FULLY RESOLVED / TERMINAL (2026-07-17 20:27Z) — loop closed, nothing resumes.

## The flake and its TRUE cause

**#11951** — the dominant `.slang.3 syn (llvm)` JSON-RPC IPC-drop ("Sig-B"): under `-server-count 8` on Windows GPU runners the test-server child drops the IPC connection (`waitForResult()/hasMessage()`, 1 FAILED, zero compile/assert/device-loss). Tracked Infra issue, maintainer-assigned (jkwak-work). Generalized 07-10 to path-level — the same fingerprint hit a 2nd test file, proving the cause is the **LLVM-synth test-server JSON-RPC path itself**, not any one test's codegen.

**TRUE root cause = JIT-teardown use-after-free**, fixed by **PR #12114** (`bf7a78ab25f4`, merged 07-15 21:40:44Z, branch `fix/issue-11951`, dual-approved juliusikkala + jkwak-work). Mechanism: context freed INSIDE `LLVMBuilder::generateJITLibrary()` when `jit->initialize()` materializes a module with `llvm.global_ctors`, before the builder dtor (verified vs LLVM 21.1.2; declaration order was NOT the crux). The fix resets borrower members before the ORC ThreadSafeModule move (+ regression test `tests/llvm/jit-teardown-debug-info.slang`). **#12056/AVX-512 (`SLANG_DISABLE_AVX512=1`, merged 07-10) was incidental partial mitigation, not the fix.**

## How the resolution was reached (the mis-attribution arc)

jkwak first closed #11951 (07-15) pointing at #12056, mechanism = VM over-reports AVX-512 → JIT emits `kmovd`/masked `vmovss` → physical host rejects → `EXCEPTION_ILLEGAL_INSTRUCTION` → child terminates → parent sees the RPC drop. We then flagged a **real fix-gap** (Sig-B still firing with the export ACTIVE on unrelated PRs), but **mis-attributed it to an AVX-512 residual**. jkwak filed local-repro #12146, then closed it 07-17 pointing at #12114. Discriminator (babysitter, [Report] msg 6): all 8 failing master merge-group runs whose trees provably contain #12114 (ancestry-confirmed) carried **ZERO** Sig-B fingerprints (826 *passing* `syn(llvm)` lines); all 3 fix-gap receipts predated the 21:40Z merge on trees still carrying the UAF. UAFs are nondeterministic → the generateJITLibrary UAF manifests intermittently on non-`-g` runs = exactly the flake. Loop-close comment: https://github.com/shader-slang/slang/issues/11951#issuecomment-5007190490.

## Durable lessons (issue-specific)

- ⭐⭐ **`head -N` truncated grep is the same trap as name-grepping a `passed test:` line.** Twice a receipt was mis-called by grepping only the early log lines: a truncated grep catches an early `passed …syn(llvm)` and misses a later genuine `FAILED test:` ~11 min on. Grep `FAILED test:` across the WHOLE log, never `head`-truncated. Each escalation receipt must pass the **trifecta**: export-active + genuine FAILED-line + a test **unrelated to the PR's own change** (the #12105 receipt was contaminated — an allocator PR failing on its own allocator tests). See [[feedback_signature_grep_passed_vs_failed]].
- ⭐⭐ **Killing a contaminated receipt ≠ disproving the hypothesis.** My retraction over-corrected — right that #12105 was its own mimalloc fault, wrong to conclude "no bug to chase." Correct retraction is narrow: "receipt withdrawn; hypothesis neither confirmed nor denied — need a clean one." (#12064/#11979 later were the clean receipts, so the fix-gap was real at claim-precision, then reconciled to the UAF cause.)
- ⭐ **"No recurrence on a PARKED branch is not evidence of a fix"** — hold hedges when the mechanism (here AVX-512-specifically) stays unproven while the fix-gap fact is established.
- **PLAYBOOK RETIRED:** the AVX-512 "(a) rebase-stale vs (b) fix-gap" discriminator is DEAD. New rule: any NEW `*.slang.3 syn (llvm)` JSON-RPC drop on a **post-#12114 tree** is a FRESH issue, NOT a #11951 reopen.

**Open follow-up (low priority, note only):** re-check [[project — #11955 CPU-LLVM SIGSEGV]] on the same `.slang.3 syn (llvm)` boundary against the #12114 UAF — may share the root cause.

Cross-refs: [[project_12105_mimalloc_windows_malloc_free]], [[project_nv_slang_bot_readonly_incident]], [[feedback_github_comment_hygiene]].
