---
name: project_11951_testserver_jsonrpc_pathlevel_flake
description: "#11951 Sig-B test-server JSON-RPC IPC-drop flake — now PATH-LEVEL (2 test files); jkwak-work owns; NO bot fixer; escalation-armed"
metadata: 
  node_type: memory
  type: project
  originSessionId: ddab6188-0f28-4222-8b37-6ae1cbb4b414
---

**#11951** — recurring CI flake, the dominant `.slang.3 syn (llvm)` JSON-RPC IPC-drop ("Sig-B"): test-server child drops the IPC connection (`computeTrivialD3D12 sendCall` → `waitForResult()/hasMessage()`, 1 FAILED, **zero** compile/assert/device-loss) under `-server-count 8` on Windows GPU runners. Tracked Infra issue, labels `CI`/`Infra`, **assigned to jkwak-work** (maintainer, 07-08 17:07Z). Convergence lead with [[project — #11955 CPU-SIGSEGV on same `.slang.3 syn (llvm)` boundary]] posted 07-08 16:17Z (not frame-confirmed).

**07-10 06:00Z — GENERALIZED to path-level (my generalization-watch trigger fired):** the identical fingerprint hit a **2nd distinct test file** `static-const-vector-array.slang.3 syn (llvm)` (was only `static-const-matrix-array`), run 29068393170. Two trivial `static const` array constant-fold tests, same synth/JIT+IPC path → root cause is the **LLVM-synth test-server JSON-RPC path itself under `-server-count 8`, not any one test's codegen.** Strengthens harden-the-IPC-path fix direction over per-test quarantine (quarantine just moves the drop to the next `.slang.3 syn (llvm)` in queue). Babysitter posted the evidence to [#11951 comment 4932530933](https://github.com/shader-slang/slang/issues/11951#issuecomment-4932530933), notifying jkwak-work.

**Disposition (07-10):**
- **NO bot fixer chain.** Deep infra, high blast radius, maintainer-assigned → jkwak-work drives. Do NOT auto-dispatch a fixer. Babysitter role holds: surface + route + rerun-under-cap.
- **Not an operator escalation yet.** Reruns-under-cap is the working workaround; maintainer owns fix; issue-comment notifies assignee.
- **Throughput cost:** #12030 evicted from merge queue 07-10 04:09Z by same Sig-B drop; left unrequeued (stale SHA 824e24f2→12ab082d, bot enqueue 403 per [[project_nv_slang_bot_readonly_incident]] / #11675, needs author/GitHub-auto requeue).

**Escalation thresholds (ARMED — babysitter will flag as separate operator-prioritization line):** either (a) a **3rd** distinct `.slang.3 syn (llvm)` file catches the fingerprint, OR (b) Sig-B **merge-queue evictions cluster** (2+ PRs in one sweep). At that point it becomes an operator prioritization call regardless of maintainer assignment. Babysitter owns the CI-health surface + occurrence-posting; I hold the escalation-decision state.
