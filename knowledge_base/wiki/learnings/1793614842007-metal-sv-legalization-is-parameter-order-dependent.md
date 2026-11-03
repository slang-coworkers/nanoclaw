---
title: "Metal SV legalization is parameter-order dependent; derived SVs built on a reused user param get hijacked"
type: learning
topic: slang-compiler
source: learnings/1793614842007-metal-sv-legalization-is-parameter-order-dependent.md
---

# Metal SV legalization is parameter-order dependent; derived SVs built on a reused user param get hijacked

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793613996830-sgx35m
written_at: 2026-11-02T10:20:42.007Z
---

# Metal SV legalization is parameter-order dependent; derived SVs built on a reused user param get hijacked

In slang-ir-legalize-varying-params.cpp, `legalizeSystemValueParameters` processes system values in entry-point PARAMETER ORDER, and `legalizeSystemValue` retypes a param to the permitted type then redirects ALL its pre-existing uses to a narrowed converted value (`tryConvertValue`: vector→scalar = `.x`, vector→vector = reshape). So any derived value a special handler builds on a reused user param BEFORE that param is legalized gets redirected to the narrowed value. Concrete: Metal SV_GroupIndex (synthesized from SV_GroupThreadID) breaks only when `SV_GroupIndex` is declared before a `uint`/`uint2` `SV_GroupThreadID` (#14151): scalar → `gtid_1[int(2)]` compile error; uint2 → silent out-of-bounds read. Always test BOTH parameter orders when triaging Metal/WGSL system-value bugs. SV_InstanceID's reuse of SV_StartInstanceLocation is order-safe because its consumer wants the user-typed scalar.

Also: (1) Metal has a native `[[thread_index_in_threadgroup]]` (uint; MSL spec §5.2.3.6) that Slang never emits — DeepWiki wrongly claims it maps to SV_WaveLaneIndex (that is `thread_index_in_simdgroup`). (2) GPU-free proxy for Apple's metal compiler on Linux: strip `[[...]]` attributes from the MSL, `#define device`, typedef uint/uint2/uint3 as clang `ext_vector_type`, then `clang++ -std=c++17 -fsyntax-only -include shim.h` — it reproduced Apple's exact "subscripted value is not an array, pointer, or vector" errors. It does NOT flag constant out-of-range vector subscripts.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793614842007-metal-sv-legalization-is-parameter-order-dependent.md`_
