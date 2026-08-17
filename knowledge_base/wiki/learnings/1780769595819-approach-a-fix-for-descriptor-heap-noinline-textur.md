---
title: "Approach-A fix for descriptor-heap [noinline] texture params: reuse the hoistable heap global, do NOT parameterize it as uint"
type: learning
topic: misc
source: learnings/1780769595819-approach-a-fix-for-descriptor-heap-noinline-textur.md
---

# Approach-A fix for descriptor-heap [noinline] texture params: reuse the hoistable heap global, do NOT parameterize it as uint

# Approach-A fix for descriptor-heap [noinline] texture params: reuse the hoistable heap global, do NOT parameterize it as uint

Outcome of shader-slang/slang#11498 (root cause of #11496), fixed in PR #11502 (Approach A, reviewer 4-round APPROVE, final commit `ffe92ec`). Closes the loop on the earlier learning "spvDescriptorHeapEXT path uses kIROp_SPIRVLoadDescriptorFromHeap, not IRCastDescriptorHandleToResource".

## The fix that worked

Route `kIROp_SPIRVLoadDescriptorFromHeap` through function-call specialization the same way `IRCastDescriptorHandleToResource` already is — add it to the allowlist sites in `slang-ir-specialize-function-call.cpp` (`isParamSuitableForSpecialization`, `getCallInfoForArg`, `getSpecializedValueForArg`) and `slang-ir-specialize-buffer-load-arg.cpp`. This makes the orphan-IRParam precondition **structurally unreachable**: the cloned `[noinline]` callee now materializes its texture as a fresh in-block `SPIRVLoadDescriptorFromHeap` instead of the texture param surviving as an orphan into the clone path. **Pass-077 `lowerBufferElementTypeToStorageType` was NOT touched** — the triage memo flagged it as a co-suspect, but Approach A removes the precondition upstream so the pass-077 desync never gets a stale value-level reference to chase. (Triage's "fastest correct fix that doesn't regress adjacent surfaces" instinct was right; the heavier Approach B was unnecessary.)

## The non-obvious implementation hazard (caught in review round 1)

The naive first cut **parameterized the descriptor-heap builtin global as a `uint` `OpFunctionParameter`** in the specialized callee. That makes the cloned callee use a uint scalar as the **base of `OpUntypedAccessChainKHR`** → invalid SPIR-V. `spirv-val` flagged it: `OpFunctionCall Argument '%slang_resourceHeap's type does not match ... '6[%uint]'`. A text-only FileCheck plus 452/452 local-green **masked it** — the crash was gone but the output was invalid SPIR-V.

**Correct shape:** in `getSpecializedValueForArg`, reuse the **hoistable heap global directly** in the cloned callee and **parameterize only the `index`**, keying the new value on the **result type** (not on re-loading the heap as a scalar param). Anyone adding a heap-descriptor opcode to a specialization allowlist must follow this shape, not pass the heap operand through as a scalar.

## Methodology takeaway

When verifying a SIGSEGV→fixed transition for a SPIR-V emit bug, "exit 0 + FileCheck green" is NOT sufficient — **always run `SLANG_RUN_SPIRV_VALIDATION=1`** (and prefer asserting on the specific SPIR-V op, e.g. `OpUntypedAccessChainKHR` reads `%slang_resourceHeap` not a uint param). A crash fix can produce structurally invalid SPIR-V that a non-validating text check won't catch. The multi-reviewer pass earned its keep here precisely because a candidate with green local tests still emitted invalid output.

Final acceptance: repro compiles to valid SPIR-V (`OpImageSampleImplicitLod`, validator clean, no SLANG_UNEXPECTED); regression test `tests/bugs/gh-11498-descriptor-handle-noinline.slang` (3 `//TEST:SIMPLE` arms: texture / sampler-heap / buffer-load-path); `tests/bugs/` 454/454, 0 regressions.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780769595819-approach-a-fix-for-descriptor-heap-noinline-textur.md`_
