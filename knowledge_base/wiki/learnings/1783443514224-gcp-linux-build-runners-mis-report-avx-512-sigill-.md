---
title: "GCP linux-build runners mis-report AVX-512 → SIGILL in slang-llvm JIT (recurring env class; check FIRST for per-VM CPU-path flakes)"
type: learning
topic: ci-tooling
source: learnings/1783443514224-gcp-linux-build-runners-mis-report-avx-512-sigill-.md
---

# GCP linux-build runners mis-report AVX-512 → SIGILL in slang-llvm JIT (recurring env class; check FIRST for per-VM CPU-path flakes)

Recurring runner-environment class in shader-slang/slang CI. **2nd confirmed instance** (1st: May-2026 AVX-512 SIGILL on hosted runners; 2nd: #11831, fixed by merged PR #11974 2026-07-07).

**Symptom class:** a per-VM, low-frequency (~1/N) flake on a CPU/LLVM test path in a GCP `linux-build`-pool job — surfaces as SIGILL, or as a *downstream* symptom like the ASan "runtime does not come first in initial library list" startup abort (#11831). Re-runs green on a fresh pool VM.

**Root cause:** some GCP pool VMs mis-report AVX-512 support their host can't reliably execute. slang-llvm's JIT (`createAVX512SafeLLJIT` → `disableAVX512ForJIT`, `source/slang-llvm/slang-llvm-jit-shared-library.cpp`) then emits AVX-512 instructions the host faults on → SIGILL, which can cascade into other test-harness failures.

**Fix / mitigation:** `export SLANG_DISABLE_AVX512=1` in the affected workflow's test step (pins x86-64 JIT to baseline CPU). The regular CPU-only + Linux coverage workflows already opt in; #11974 added it to `ci-slang-sanitizer.yml:201`. slangc smoke steps don't JIT so they don't need it.

**Triage heuristic (the real lesson):**
1. For a per-VM SIGILL / CPU-path / LLVM-JIT-path flake, check **AVX-512 mis-report FIRST** before guessing exotic causes (loader preloads, etc.).
2. Env-flake verdicts should **assert the CLASS confidently ("per-VM runner/env trigger") but label the SPECIFIC mechanism as a HYPOTHESIS.** On #11831 we correctly called it env but over-committed to a stray `/etc/ld.so.preload`; the real cause was AVX-512. Both env, wrong mechanism.
3. **GitHub Actions job logs 410 (Gone) after ~7-day retention** — so the decisive failing-run log is usually already gone by the time a flake is triaged. You often *cannot* confirm the specific mechanism from primary evidence; don't post it as established. Verify what you can (code refs, PR state) and mark the rest hypothesis.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1783443514224-gcp-linux-build-runners-mis-report-avx-512-sigill-.md`_
