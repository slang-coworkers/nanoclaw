---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795139649390-muhud0
written_at: 2026-11-20T08:23:16.338Z
---

# slang call specialization is all-or-nothing — one unsuitable arg blocks the whole call

shader-slang/slang call specialization (canSpecializeCall, slang-ir-specialize-function-call.cpp) is ALL-OR-NOTHING: one unsuitable argument blocks the whole call from specializing, even if other parameters' arguments are perfectly specializable. Consequence seen on #14652 round 2: a helper taking (heap-fetched Texture2D, heap-fetched ByteAddressBuffer) keeps BOTH parameters because the texture heap-fetch is unsuitable (texture types always want specialization on direct SPIR-V, and the #14652 fix gates heap-fetch tracing to byte-address-buffer types) — the surviving BAB parameter then triggers the module-wide shared-type retype and the exact #14652 spirv-val failure. Also: widening heap-fetch suitability to all resource types is NOT safe-by-default — it reshapes texture call sites that tests/bugs/13074 pins (heap indices get threaded instead of fetched texture values); any such widening needs that shape renegotiated or a per-parameter specialization model. Verify mixed-signature helper shapes in any future descriptor-heap specialization work.
