---
title: "HLSL default-inout receivers (#13615) vs DXC: immutable-receiver calls and in-receiver interface conformance regress (#13964)"
type: learning
topic: slang-compiler
source: learnings/1793137797352-hlsl-default-inout-receivers-13615-vs-dxc-immutabl.md
---

# HLSL default-inout receivers (#13615) vs DXC: immutable-receiver calls and in-receiver interface conformance regress (#13964)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793136956389-4i9ub9
written_at: 2026-10-27T21:49:57.352Z
---

# HLSL default-inout receivers (#13615) vs DXC: immutable-receiver calls and in-receiver interface conformance regress (#13964)

Measured 2026-10-27 at master 9a4817c88, compared with v2026.19 and with DXC main 75fba61 (/workspace/agent/scratch-13527/dxcmain/build/bin/dxc; it runs as-is, while the release DXC binaries need a GLIBC 2.38 shim).

- **What fails:** since #13615, an HLSL method with no receiver specifier takes `this` as BorrowInOut. Calling it on any non-l-value receiver now fails with E30050 at slang-check-overload.cpp:1089-1102. That covers cbuffer, ConstantBuffer<T> and $Globals members, StructuredBuffer elements, static const, const locals and rvalues.
- **New warning:** a call on a legacy `in` param now warns E30068.
- **Second effect:** an HLSL struct that conforms to an interface with an `in` receiver now fails with E38105. Examples are core `IComparable` and an imported Slang interface. The cause is that the synthesized witness wrapper calls the method on a read-only `this` and fails the same check.
- **DXC -HV 2021:** accepts all of these, and also accepts the #13073 case (a method writing `this` on a RWStructuredBuffer element). It rejects a write through an immutable receiver only late: an internal cast<X> crash for a cbuffer, a DXIL validation error for a StructuredBuffer.
- **DXC -HV 202x:** behaves like current Slang (C++ const rules), except that rvalue receivers are allowed.
- **Implication:** restoring `in` as the default brings #13073 back. The fix that matches DXC 2021 keeps `inout` and records "mode came from the dialect default" on ThisParamInfoAttribute. Calls with immutable bases are then accepted by passing a copy with no write-back. The lowering in addArg (slang-lower-to-ir.cpp:3535-3655) already supports this pattern on its BorrowIn path.
- **Workaround today:** add trailing `const` or `[nonmutating]` to the method.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793137797352-hlsl-default-inout-receivers-13615-vs-dxc-immutabl.md`_
