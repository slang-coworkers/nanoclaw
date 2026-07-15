---
title: "Sig-B test-server JSON-RPC drop = AVX-512 JIT SIGILL (11951 resolved by 12056)"
type: learning
topic: misc
source: learnings/1784089175111-sig-b-test-server-json-rpc-drop-avx-512-jit-sigill.md
---

# Sig-B test-server JSON-RPC drop = AVX-512 JIT SIGILL (11951 resolved by 12056)

**What:** The recurring Slang CI failure fingerprinted as "#11951 Sig-B" — a `JSON RPC failure: waitForResult()/hasMessage()` drop on `tests/compute/static-const-matrix-array.slang.3 syn (llvm)` (or the `static-const-vector-array` sibling), windows-*-gpu `test-slang`, ~99% of tests passing — was **NOT an IPC-layer bug**. Root cause: **AVX-512 JIT SIGILL.** LLVM over-reports AVX-512 support on virtualized CI hosts → slang-llvm's JIT emits `kmovd`/masked `vmovss` → the physical host rejects them → `EXCEPTION_ILLEGAL_INSTRUCTION` (0xc000001d) kills the test-server **child** process → the parent harness only sees the generic `waitForResult()/hasMessage()` drop. The `.slang.3 syn (llvm)` victims are exactly the LLVM-synth/JIT codegen path.

**Fix:** PR #12056 "Apply AVX-512 JIT workaround to all CI tests" (merged 2026-07-10, `01adc68f`). **Workflow-only** — exports `SLANG_DISABLE_AVX512=1` unconditionally in `.github/workflows/ci-slang-test.yml` (line ~99) + `ci-slang-coverage-test.yml`. jkwak-work **closed #11951 on 2026-07-15**.

**Why it matters / how to apply:** This was the single largest CI rerun bucket (55 hits/31 PRs in the week before closure). If you see this fingerprint on a PR now:
- `pull_request` runs use the workflow from the **PR head tree**, not master. Check: `gh api repos/shader-slang/slang/contents/.github/workflows/ci-slang-test.yml?ref=<head-sha> --jq .content | base64 -d | grep SLANG_DISABLE_AVX512`.
- **Export absent in head tree** → branch predates/never merged the fix → **advise rebase**, not rerun (rerun reproduces it).
- **Export present + was active in the failing run yet Sig-B still fired** → possible **fix-gap** (env var not reaching the JIT on that tier, or a different child-death cause) → worth surfacing for a #11951 re-examination.

**Caveat:** the parent-side drop is generic (it's whatever killed the child); it's *consistent* with AVX-512 SIGILL but the SIGILL string does not surface parent-side, so don't assert SIGILL from the drop alone. Also re-examine whether #11955 (linux `test-linux-release-gcc-x86_64-cpu/test-slang` SIGSEGV/hang, same LLVM-synth path) shares this AVX-512 root cause — #12056 may or may not cover the linux-cpu tier.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1784089175111-sig-b-test-server-json-rpc-drop-avx-512-jit-sigill.md`_
