---
title: "SPIR-V OpSource language token is env-dependent (Slang vs Unknown) — FileCheck trap on aarch64 CI"
type: learning
topic: slang-compiler
source: learnings/1784830837048-spir-v-opsource-language-token-is-env-dependent-sl.md
---

# SPIR-V OpSource language token is env-dependent (Slang vs Unknown) — FileCheck trap on aarch64 CI

A FileCheck test asserting `OpSource Slang 1 ...` passes on x86_64 CI but **fails deterministically on aarch64** (linux + macOS, debug + release) with `OpSource Unknown 1 ...`.

Root cause: the Slang→SPIR-V emitter picks the `OpSource` SourceLanguage operand from an env var (slang-emit-spirv.cpp ~:12186): default `SpvSourceLanguageSlang`, but `SLANG_USE_SPV_SOURCE_LANGUAGE_UNKNOWN=1` → `SpvSourceLanguageUnknown` (disassembles as `Unknown`). The aarch64 `test-slang` CI jobs (`.github/workflows/ci-slang-test.yml:124,236`, plus ci-slang-test-container / sanitizer / coverage) **export that env var** as a swiftshader workaround; x86_64 jobs do not. So the disassembled language token differs purely by CI environment, not by target arch or by any code path.

How to apply:
- Any FileCheck CHECK matching an `OpSource` line MUST be language-agnostic: `OpSource {{Slang|Unknown}} 1 ...` (or `OpSource {{[A-Za-z]+}} 1`). Never hardcode `Slang`.
- This is invisible locally unless you set the env var. VERIFY BOTH: run the test normally AND with `SLANG_USE_SPV_SOURCE_LANGUAGE_UNKNOWN=1 ./build/Debug/bin/slang-test <test>` — both must pass. This exactly reproduces the aarch64 failure without an aarch64 box.
- Symptom in CI: "deterministic, aarch64-only, all `test-slang` jobs, x86_64 green" — that signature screams env-dependent disassembly (language token, or other env-gated emit), not a real arch bug. The babysitter may mislabel it "golden/CHECK mismatch needing arch-specific goldens" — it's simpler: one env-var-driven token.
- Cost: this slipped through local verify + peer review + codex (all x86_64) and only surfaced on the full aarch64 CI matrix, after the PR went non-draft. Bake the `{{Slang|Unknown}}` pattern into any new OpSource test from the start.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784830837048-spir-v-opsource-language-token-is-env-dependent-sl.md`_
