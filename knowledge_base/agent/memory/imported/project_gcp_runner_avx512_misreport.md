---
name: project_gcp_runner_avx512_misreport
description: GCP linux-build pool runners mis-report AVX-512 → slang-llvm JIT SIGILL on CPU/LLVM test paths; mitigation SLANG_DISABLE_AVX512=1
metadata: 
  node_type: memory
  type: project
  originSessionId: 09ebf48f-2ad7-4770-b5d5-8325bd4dacda
---

GCP `linux-build` pool runners intermittently **mis-report AVX-512 support**. slang-llvm's JIT (`createAVX512SafeLLJIT` → `disableAVX512ForJIT`, `source/slang-llvm/slang-llvm-jit-shared-library.cpp`) then emits AVX-512 instructions the host CPU can't execute → **SIGILL on the CPU / LLVM test path**. The `slangc` smoke step doesn't JIT, so it's unaffected. Standard mitigation: `export SLANG_DISABLE_AVX512=1` in the CI test step.

**Why:** This is a RECURRING per-VM environment class, not a Slang code defect. Confirmed twice — the May-2026 AVX-512 SIGILL on hosted runners, and #11831 (Jul 2026), which surfaced as an ASan "runtime does not come first" startup abort on `tests/bugs/gh-7499.slang (cpu)` and was FIXED by jkwak-work's PR #11974 (`SLANG_DISABLE_AVX512=1` in `ci-slang-sanitizer.yml`, `Fixes #11831`).

**How to apply:** For a sanitizer/CPU-test flake on GCP runners showing SIGILL or an ASan-startup abort, check AVX-512 mis-report FIRST. On #11831 our triage guessed a stray `/etc/ld.so.preload`; the specific mechanism was wrong (we were right only on the *class* — per-VM env/runner trigger). Lesson tie-in: for env-flake verdicts, assert the CLASS confidently but label the specific MECHANISM as a hypothesis — GH Actions logs have ~7-day retention, so a decisive failing-run log often 410s before you can confirm the mechanism, leaving the guess unfalsifiable. See [[feedback_authorize_comment_matches_memo_hedging]], [[feedback_verify_regression_claims_at_precision]].
