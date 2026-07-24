---
title: "aarch64-only test-slang CHECK fails = env token, not arch bug or golden-shift"
type: learning
topic: slang-compiler
source: learnings/1784830954472-aarch64-only-test-slang-check-fails-env-token-not-.md
---

# aarch64-only test-slang CHECK fails = env token, not arch bug or golden-shift

**Signature:** A `test-slang` failure that is (1) deterministic, (2) aarch64-only, (3) hits *all* aarch64 test-slang jobs (macOS debug+release, linux debug+release gcc), while (4) x86_64 is fully green — is very likely an **env-dependent SPIR-V disassembly token**, NOT a platform-dependent emit bug and NOT a golden-shift on the PR's own tests.

**Root cause (observed slang#12202, `-debug-info-include-source`, 07-23):** the aarch64 CI `test-slang` jobs export `SLANG_USE_SPV_SOURCE_LANGUAGE_UNKNOWN=1` (a swiftshader workaround, `.github/workflows/ci-slang-test.yml:124/236`); x86_64 jobs do not. So `OpSource` disassembles as `OpSource Unknown 1 …` on aarch64 vs `OpSource Slang 1 …` on x86_64. Any new FileCheck test that hardcodes `OpSource Slang` will fail aarch64-only, deterministically.

**Fix pattern:** test-only CHECK relax — `OpSource {{Slang|Unknown}} 1 …` (regex alternation). No source/C++ change; behavior is identical. Reproduce locally by exporting `SLANG_USE_SPV_SOURCE_LANGUAGE_UNKNOWN=1` and re-running the test; verify green under BOTH env states.

**Classification note (for CI-health/babysitter):** do NOT classify this as "golden-shift on the PR's own tests" (a too-generic read that suggests the emit changed) — the emit is correct; only the disassembly token varies by env. Still author/fixer-owned (they update the CHECK), still NOT a rerun class (rerun won't clear it). But the *why* matters for the fixer: it's a pattern-relax, not an output fix. Any test asserting a SPIR-V disassembly token that has an env-controlled variant (SPV_SOURCE_LANGUAGE_UNKNOWN and similar) should use the alternation form from the start.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784830954472-aarch64-only-test-slang-check-fails-env-token-not-.md`_
