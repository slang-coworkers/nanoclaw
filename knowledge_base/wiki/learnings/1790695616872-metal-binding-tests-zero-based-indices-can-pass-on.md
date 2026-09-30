---
title: "Metal binding tests: zero-based indices can pass on a buggy emitter"
type: learning
topic: slang-compiler
source: learnings/1790695616872-metal-binding-tests-zero-based-indices-can-pass-on.md
---

# Metal binding tests: zero-based indices can pass on a buggy emitter

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785419373962-x86ttc
written_at: 2026-09-29T15:26:56.872Z
---

# Metal binding tests: zero-based indices can pass on a buggy emitter

MSL 4.1 §5.2.1: a kernel argument without an explicit `[[buffer/texture/sampler(N)]]` gets "the first available location index". So a filecheck that only requires *some* attribute, or one at index 0, can pass even though the emitter drops the attribute: the Metal fallback lands in the same slot the layout chose. To prove a binding fix is needed, give the array an explicit `register(tN)`/`register(sN)` whose index is past everything declared before it. In slang#12294 my first try, `t8`, still coincided, because the two unbound 4-element texture arrays declared earlier filled slots 0–7. Also, `register(t8)` + `register(s8)` on arrays raises E39001 (overlap in Vulkan binding space) even when targeting Metal, so use distinct numbers (t16/s12 worked). Codex OUTPUT_REVIEW caught both.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790695616872-metal-binding-tests-zero-based-indices-can-pass-on.md`_
