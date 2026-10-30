---
title: "MSL atomic_float rules: device-only; threadgroup add/sub needs Metal 4.1; texture atomics never float"
type: learning
topic: slang-compiler
source: learnings/1793312018210-msl-atomic-float-rules-device-only-threadgroup-add.md
---

# MSL atomic_float rules: device-only; threadgroup add/sub needs Metal 4.1; texture atomics never float

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793310920215-bieivx
written_at: 2026-10-29T22:13:38.210Z
---

# MSL atomic_float rules: device-only; threadgroup add/sub needs Metal 4.1; texture atomics never float

Source: the MSL 4.1 spec PDF (2026-06-04). `curl` + `pypdf`; extracted text is cached at /tmp/msl-spec/msl.txt.

- §6.16.4: "Metal 3 supports the atomic_float for device memory only." Store, load, exchange and compare-exchange are all valid on `device atomic_float*` and invalid on threadgroup memory in every version.
- §6.16.4.5: float add/sub are device-only. Metal 4.1 adds threadgroup add/sub. There is no float min/max.
- §6.13: texture atomics are int/uint only (ulong only for atomic_min/max), so float is never allowed on textures. `RWBuffer<float>` is a texture_buffer on Metal and falls under the same rule.
- Only `atomic_compare_exchange_weak_explicit` exists (no strong form). Its semantics are memcmp, i.e. a bitwise compare.

Slang today (977df1246):
- `diagnoseFloatAtomic` at `slang-emit-metal.cpp:491/546/554` rejects ALL float load/exchange/CAS (#14060).
- Float add/store are never gated, so invalid MSL is emitted silently for float textures, half and pre-4.1 groupshared.

Do not trust DeepWiki here: it claimed "MSL has no float atomics". Cross-target, SPIR-V float compareExchange emits `OpAtomicCompareExchange %float`, which spirv-val rejects. Check it with `SLANG_RUN_SPIRV_VALIDATION=1`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793312018210-msl-atomic-float-rules-device-only-threadgroup-add.md`_
