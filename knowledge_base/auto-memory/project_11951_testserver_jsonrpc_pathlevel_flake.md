---
name: project_11951_testserver_jsonrpc_pathlevel_flake
description: "✅ RESOLVED #11951 Sig-B test-server JSON-RPC IPC-drop flake — root-caused as AVX-512 JIT SIGILL; fixed by #12056 (MERGED 01adc68f3); jkwak-work closed 07-15"
metadata: 
  node_type: memory
  type: project
  originSessionId: ddab6188-0f28-4222-8b37-6ae1cbb4b414
---

**✅ RESOLVED / TERMINAL (2026-07-15).** jkwak-work closed #11951 (stateReason COMPLETED, cmt 4975629716) pointing at **PR #12056 "Apply AVX-512 JIT workaround to all CI tests" — MERGED 2026-07-10, commit `01adc68f3` confirmed in master.** Root-cause fix (maintainer option A), NOT a quarantine/mask. **Mechanism (triager-verified with in-tree receipts):** on virtualized hosts incl. Windows runners, LLVM host-detection over-reports AVX-512 → JIT emits `kmovd`/masked `vmovss` → physical host rejects → `EXCEPTION_ILLEGAL_INSTRUCTION` → slang-test test-server CHILD terminates → parent sees the JSON-RPC `waitForResult()/hasMessage()` drop. Fix activates in-tree `disableAVX512ForJIT` helper (source/slang-llvm/slang-llvm-jit-shared-library.cpp) by exporting `SLANG_DISABLE_AVX512=1` UNCONDITIONALLY in ci-slang-test.yml:99 — generalizes the pre-existing Linux-CPU-only #11062 workaround to all CI tiers incl. windows-debug-gpu. Options B (quarantine) / C (reduce server-count) retired as unnecessary. Triage had the mechanism right (child crash, not RPC-layer bug) and correctly ruled out the "harden IPC retry" dead-end; precise AVX-512 cause needed a virtualized-Windows repro we couldn't produce. Merge-queue disruptor cleared at source. Reopen only on a fresh substantive human comment. **Historical context below.**

---

**#11951** — recurring CI flake, the dominant `.slang.3 syn (llvm)` JSON-RPC IPC-drop ("Sig-B"): test-server child drops the IPC connection (`computeTrivialD3D12 sendCall` → `waitForResult()/hasMessage()`, 1 FAILED, **zero** compile/assert/device-loss) under `-server-count 8` on Windows GPU runners. Tracked Infra issue, labels `CI`/`Infra`, **assigned to jkwak-work** (maintainer, 07-08 17:07Z). Convergence lead with [[project — #11955 CPU-SIGSEGV on same `.slang.3 syn (llvm)` boundary]] posted 07-08 16:17Z (not frame-confirmed).

**07-10 06:00Z — GENERALIZED to path-level (my generalization-watch trigger fired):** the identical fingerprint hit a **2nd distinct test file** `static-const-vector-array.slang.3 syn (llvm)` (was only `static-const-matrix-array`), run 29068393170. Two trivial `static const` array constant-fold tests, same synth/JIT+IPC path → root cause is the **LLVM-synth test-server JSON-RPC path itself under `-server-count 8`, not any one test's codegen.** Strengthens harden-the-IPC-path fix direction over per-test quarantine (quarantine just moves the drop to the next `.slang.3 syn (llvm)` in queue). Babysitter posted the evidence to [#11951 comment 4932530933](https://github.com/shader-slang/slang/issues/11951#issuecomment-4932530933), notifying jkwak-work.

**Disposition (07-10):**
- **NO bot fixer chain.** Deep infra, high blast radius, maintainer-assigned → jkwak-work drives. Do NOT auto-dispatch a fixer. Babysitter role holds: surface + route + rerun-under-cap.
- **Not an operator escalation yet.** Reruns-under-cap is the working workaround; maintainer owns fix; issue-comment notifies assignee.
- **Throughput cost:** #12030 evicted from merge queue 07-10 04:09Z by same Sig-B drop; left unrequeued (stale SHA 824e24f2→12ab082d, bot enqueue 403 per [[project_nv_slang_bot_readonly_incident]] / #11675, needs author/GitHub-auto requeue).

**Escalation thresholds (ARMED — babysitter will flag as separate operator-prioritization line):** either (a) a **3rd** distinct `.slang.3 syn (llvm)` file catches the fingerprint, OR (b) Sig-B **merge-queue evictions cluster** (2+ PRs in one sweep). At that point it becomes an operator prioritization call regardless of maintainer assignment. Babysitter owns the CI-health surface + occurrence-posting; I hold the escalation-decision state.
