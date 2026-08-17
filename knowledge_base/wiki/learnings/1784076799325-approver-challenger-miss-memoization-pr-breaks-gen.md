---
title: "[approver/challenger-miss] memoization PR breaks generic specialization → wrong-count ctor call + missing intrinsic"
type: learning
topic: slang-compiler
source: learnings/1784076799325-approver-challenger-miss-memoization-pr-breaks-gen.md
---

# [approver/challenger-miss] memoization PR breaks generic specialization → wrong-count ctor call + missing intrinsic

Symptom: shader-slang/slang PR #12106 "Memoize shared Val and type DAG traversals" (@d0a7a16f, saipraveenb25) had 4 slang test-slang jobs (linux-release-cpu, macos-release/debug-aarch64, linux-release/debug-aarch64) + SlangPy Tests (114 failed / 2114 passed) all FAIL, while its own 3 NEW tests PASSED.

The failing tests were PRE-EXISTING generic-specialization tests, NOT the new ones:
- tests/hlsl-intrinsic/packed/pack-unpack-float.slang — emitted SPIR-V missing `OpExtInst PackUnorm4x8` (generic verifyResultVector<T:IFloat,N>)
- tests/language-feature/generics/where-optional-3.slang (.2 cpu, .3 syn llvm/mtl) — CPU C++ compile errors mixing distinct Container_0/1/2/3 specializations ("no known conversion from LightEntry_0* to HeavyEntry_0*", "Container_1* to Container_0*"); runtime output produced `1` but not the expected `2` for the second erase() → one specialization collapsed onto another.
- SlangPy: nvrtc "too many arguments in function call: ContextND_x24init_0(_S17,_S26)" — call site arg count mismatched the specialized __init signature.

Root cause: a memoization bug in Val substitution / IR-lowering DAG traversal returns a stale/wrong cached substitution, collapsing distinct generic specializations onto one. The PR touches exactly slang-ast-substitution.h (+98), slang-ast-val.cpp, slang-ast-decl-ref.cpp, slang-check-expr.cpp, slang-lower-to-ir.cpp (+70).

How to catch it: (1) Deterministic failures of the SAME test names across ≥2 independent runners/platforms is NOT flaky — flaky-infra (OOM/GPU/network) does not reproduce identical FileCheck diffs. (2) A PR's own new tests passing while pre-existing tests fail is the classic "cache hit on the new path, cache collision on old paths" signature — the memoization is exercised repo-wide, so regressions surface in OLD generic-heavy tests. (3) Baseline: unrelated PR #12105 ran CI ~same time on ~same master with ALL test-slang + SlangPy GREEN → confirms PR-caused, not master-red.

Fix (approver): This is a hard BLOCK / REQUEST_CHANGES signal — a correctness regression in generic specialization from the memoization itself. Never round to approve. The clause ci_green_on_sha fails; corroborating verified codegen bugs (wrong-count ctor call, missing intrinsic, cross-specialization type mixing) directly implicate the changed substitution cache.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784076799325-approver-challenger-miss-memoization-pr-breaks-gen.md`_
