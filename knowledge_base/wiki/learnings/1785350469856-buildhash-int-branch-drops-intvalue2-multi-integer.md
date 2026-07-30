---
title: "buildHash Int branch drops intValue2 — multi-integer compiler options collide on cache key"
type: learning
topic: slang-compiler
source: learnings/1785350469856-buildhash-int-branch-drops-intvalue2-multi-integer.md
---

# buildHash Int branch drops intValue2 — multi-integer compiler options collide on cache key

**Issue #12270 (triage, 2026-07-29).** `CompilerOptionSet::buildHash` (`source/slang/slang-compiler-options.cpp`, the value loop ~205-216) appends only `v.intValue` for `Int`-kind `CompilerOptionValue`s and never `v.intValue2`. The `String` branch already appends BOTH `stringValue` and `stringValue2` — so the Int branch is the asymmetric/buggy one.

**Why it matters:** four options pack a second integer into `intValue2` (built via `CompilerOptionValue::fromInt2`/`fromInt3`), and all four genuinely change emitted code:
- `VulkanBindGlobals` (`-fvk-bind-globals <index> <set>`): set → `m_globalsBinding.set` (`slang-hlsl-to-vulkan-layout-options.cpp:55`), Vulkan binding allocation.
- `VulkanBindShift` / `VulkanBindShiftAll`: the shift amount lives in `intValue2` (`unpackInt3` header; `setAllShift(kind, intValue2)`).
- `TraceCoverageBinding` (`-trace-coverage-binding <index> <space>`): space read at `slang-emit.cpp:1123`.

**Two cache keys, not one.** `buildHash` feeds BOTH `getEntryPointHash` (shader cache, `include/slang.h:5379`) AND `Linkage::isBinaryModuleUpToDate` (persistent `.slang-module` freshness is digest-based). So a dropped operand → wrong artifact returned on either path.

**Fix (Approach A):** one line — `builder.append(v.intValue2);` right after the `v.intValue` append, mirroring the String case. Fixes all four options generically (correct layer: the omission is in the hash function, not per-option). A one-time cache invalidation on landing is expected and correct.

**Testing gotcha:** `buildHash` is NOT reachable from a `.slang` test driver (it's an API-level path). Regression tests live in `tools/slang-unit-test/unit-test-stdin-compile.cpp` — reuse `_getOptionEntryPointHash` + `_blobContentEquals`; the existing `..DoesNotAffectCompilerOptionHash` tests (~:1978, :2012) are the exact pattern. Write the INVERSE: differing `-fvk-bind-globals <set>` must produce differing hash blobs. Same lesson as the `applySettingsToDiagnosticSink` bug — API-path option bugs need slang-unit-test with in-memory sessions, not `.slang` files.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785350469856-buildhash-int-branch-drops-intvalue2-multi-integer.md`_
