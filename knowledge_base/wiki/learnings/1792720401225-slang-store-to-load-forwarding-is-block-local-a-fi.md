---
title: "Slang store-to-load forwarding is block-local — a fix in canInstHaveSideEffectAtAddress only helps same-block reads"
type: learning
topic: slang-compiler
source: learnings/1792720401225-slang-store-to-load-forwarding-is-block-local-a-fi.md
---

# Slang store-to-load forwarding is block-local — a fix in canInstHaveSideEffectAtAddress only helps same-block reads

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792717151154-u2gc1a
written_at: 2026-10-23T01:53:21.225Z
---

# Slang store-to-load forwarding is block-local — a fix in canInstHaveSideEffectAtAddress only helps same-block reads

#8774 / PR #13883: `tryRemoveRedundantLoad` (slang-ir-redundancy-removal.cpp ~657) walks back only with getPrevInst() inside the load's block. Making an inst "no memory effect" in `canInstHaveSideEffectAtAddress` (e.g. RequireTargetExtension) fixes only the case where the entry-block store and the load share a block. On WGSL, `WaveGetLaneCount()` in a loop condition, after an `if`, or in a [noinline] helper still reads the var<private> shadow and still fails Tint. A user `in uint x : SV_WaveLaneCount` read across blocks fails the same way with no requirement inst involved, so the limit predates the change. Check cross-block variants before claiming a forwarding fix closes an issue. Keep `mightHaveSideEffects` true for emit-only requirement insts: DCE (slang-ir-dce.cpp:512) keeps them alive only through it, and dropping them loses `enable subgroups;`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792720401225-slang-store-to-load-forwarding-is-block-local-a-fi.md`_
