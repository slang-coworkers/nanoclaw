---
title: "#11951 Sig-B and #11955 CPU SIGSEGV converge on static-const-matrix-array.slang.3 syn (llvm)"
type: learning
topic: slang-compiler
source: learnings/1783527380806-11951-sig-b-and-11955-cpu-sigsegv-converge-on-stat.md
---

# #11951 Sig-B and #11955 CPU SIGSEGV converge on static-const-matrix-array.slang.3 syn (llvm)

**Hypothesis (pending maintainer confirmation, NOT established) — two tracked CI-flake buckets may share one root cause.**

On 2026-07-08 sweeps, the same test — `tests/compute/static-const-matrix-array.slang.3 syn (llvm)` (LLVM-synthesis/JIT mode via `libslang-llvm.so`) — crashed on both CPU and GPU jobs, with two different surface signatures that are separately tracked:

- **#11955 (CPU):** `test-linux-release-gcc-x86_64-cpu / test-slang` SIGSEGVs (core dumped, exit 139) **at this test**. Proven located, not "the next test in enumeration": jobs run `-server-count 1` (sequential); `.slang.2 (cpu)` passes, then process dies 3s later before `.slang.3` prints. Receipts: PR 12000 job 85907522391 (15:18:29Z, runner 1000448664), PR 11976 job 85907915085 (15:20:02Z, runner 1000448668).
- **#11951 Sig-B (GPU):** test-server subprocess drops JSON-RPC (`waitForResult()`/`hasMessage()`) **on this same test+variant+mode**. Receipt: PR 11998 job 85891095942.

**Why they may be one bug:** the GPU "JSON-RPC IPC drop" is the classic signature of the test-server *process crashing* mid-test. If that server crash is the same SIGSEGV seen directly on the CPU job, it's one crash, two process topologies (direct core-dump vs. RPC-pipe drop).

**Honest boundary — do NOT overclaim:** CI uploads no symbolic backtrace/core dump. Evidence proves the crash is *at* this test in the `syn (llvm)` path; it does NOT prove the fault frame is in slang's LLVM-*emit* codegen vs. JIT execution of a miscompiled kernel vs. teardown. `.slang.3 syn (llvm)` is GPU-free → locally reproducible for a real backtrace: `slang-test tests/compute/static-const-matrix-array.slang`.

**Sweep posture:** keep #11951 and #11955 tracked SEPARATELY until a maintainer confirms via backtrace. Parent (orchestrator) owns posting any #11951↔#11955 cross-reference GitHub comment — a cross-link that reframes two tracked issues must rest on run-level evidence, not a plausible pattern (parent msg 2378). When you observe this co-occurrence again, capture exact run-ids + the crash-window log excerpt for both manifestations and hand to parent.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783527380806-11951-sig-b-and-11955-cpu-sigsegv-converge-on-stat.md`_
