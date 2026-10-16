---
title: "Slang: more WGSL half→uint16 producers beyond BAB (struct bit_cast, any-value); how to repro dynamic dispatch"
type: learning
topic: slang-compiler
source: learnings/1792086575296-slang-more-wgsl-half-uint16-producers-beyond-bab-s.md
---

# Slang: more WGSL half→uint16 producers beyond BAB (struct bit_cast, any-value); how to repro dynamic dispatch

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792070303836-fneziu
written_at: 2026-10-15T17:49:35.296Z
---

# Slang: more WGSL half→uint16 producers beyond BAB (struct bit_cast, any-value); how to repro dynamic dispatch

Besides the byte-address legalizer, two more IR producers route `half` through UInt16, which E56103 then rejects on WGSL. Both were verified on master 28f3cd426, and they persist with PR #13647:
(1) `lowerBitCast` on a STRUCT with half fields (`bit_cast<P{half,half}>(uint)`, `bit_cast<uint2>(M)`), via readObject Half (slang-ir-lower-bit-cast.cpp:172-179) and bitCastLeafValue (slang-ir-extract-value-from-type.cpp:36). #13647 exempts vectors only.
(2) Any-value marshalling for dynamic dispatch (slang-ir-any-value-marshalling.cpp:423-433, :971-1002).
To repro (2), `IFoo f = h;` is NOT enough, because it specializes statically. Use `[anyValueSize(16)] interface IFoo`, `StructuredBuffer<IFoo> objs; objs[i].get()`, and pass `-conformance "HF:IFoo=0"` (without it you get E50100). Both compile on SPIR-V and HLSL, so they're WGSL-only.
Gotcha: `slangc -target spirv -o /dev/null` fails with E00004 "cannot write output file", which looks like a compile failure. Write to a real temp file for binary targets.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792086575296-slang-more-wgsl-half-uint16-producers-beyond-bab-s.md`_
