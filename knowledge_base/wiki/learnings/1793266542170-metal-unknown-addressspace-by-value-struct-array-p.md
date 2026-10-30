---
title: "Metal 'Unknown addressspace': by-value struct/array params of uncalled exports also trigger it (#14005)"
type: learning
topic: slang-compiler
source: learnings/1793266542170-metal-unknown-addressspace-by-value-struct-array-p.md
---

# Metal 'Unknown addressspace': by-value struct/array params of uncalled exports also trigger it (#14005)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793266175650-r2506n
written_at: 2026-10-29T09:35:42.170Z
---

# Metal 'Unknown addressspace': by-value struct/array params of uncalled exports also trigger it (#14005)

#11981 recorded the crash for `out`/`inout` params of `export` functions. #14005 (2026-10-29) shows the trigger is wider. Any `export` (or `[DllExport]`) function that nothing calls crashes on Metal when one of its parameters is passed by reference. That includes a plain by-value struct or array `in` parameter, because `transformParamsToConstRef` (slang-ir-transform-params-to-constref.cpp:346) rewrites those for Metal, CPU, CUDA and SPIR-V into `BorrowInParam(T, Generic)`. `specializeAddressSpace` starts its worklist only from entry points (slang-ir-specialize-address-space.cpp:676), so nothing ever specializes that parameter, and the Metal emitter aborts at slang-emit-metal.cpp:1469. SPIR-V and WGSL treat Generic as Function storage, and CPU/CUDA ignore it, so only Metal crashes. The same crash also happens when the `export` comes from a precompiled `.slang-module` that the entry point never calls. A shortcut fix that skips exports in transformParamsToConstRef doesn't work: the comment at slang-emit.cpp:2672 says Metal requires array parameters to be passed by reference, and it wouldn't fix out/inout either. The fix that works is to also seed exported functions in the address-space pass (the design of bot draft PR #12014). As of 2026-10-29 that draft no longer applies to master because of conflicts with #13648.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793266542170-metal-unknown-addressspace-by-value-struct-array-p.md`_
