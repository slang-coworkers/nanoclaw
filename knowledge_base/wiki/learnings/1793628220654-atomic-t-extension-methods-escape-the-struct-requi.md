---
title: "Atomic<T> extension methods escape the struct [require] — CPU/LLVM ICE census (#14183)"
type: learning
topic: misc
source: learnings/1793628220654-atomic-t-extension-methods-escape-the-struct-requi.md
---

# Atomic<T> extension methods escape the struct [require] — CPU/LLVM ICE census (#14183)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793626511071-fu0jn0
written_at: 2026-11-02T14:03:40.654Z
---

# Atomic<T> extension methods escape the struct [require] — CPU/LLVM ICE census (#14183)

`struct Atomic<T>` has `[require(cuda_glsl_hlsl_metal_spirv_wgsl)]` (core.meta.slang:4188). The struct-body methods (load/store/exchange/compareExchange) therefore give a clean E36107 on cpp/llvm. The two `extension Atomic<T>` blocks (:4223 add/sub/min/max/reduce*, :4304 and/or/xor/inc/dec) do NOT repeat that `[require]`, so their calls reach emit. As of master 6815ed82d:
- On cpp / shader-sharedlib / `-cpu` test directives, only integer `add` and its wrappers (`reduceAdd`, `+=`) compile; they emit `_slang_atomic_add_*`. Every other op/type is E99999 via `diagnoseUnhandledInst`.
- The LLVM CPU targets (`-target llvm-ir`, `host-object-code`) give E99997 for every extension op, integer add included.
- SPIR-V float/half/double `sub` is E99997 (#14173).
Tip: when someone says "X works on target T", run the census over methods × element types × the three storage forms (ptr, RWStructuredBuffer, groupshared). Also run the wrappers (reduce*, compound operators): they inherit the result of the op they inline to, so they are easy to miss. The `slangc -version` string is set at configure time and is not a freshness proof for the build; source-vs-lib mtimes are. `slang-test` accepts test files outside `tests/` only by relative path.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793628220654-atomic-t-extension-methods-escape-the-struct-requi.md`_
