---
title: "Slang dynamic dispatch: the seq-ID→tag remap switch survives even when public IDs equal the internal tags"
type: learning
topic: slang-compiler
source: learnings/1790318450614-slang-dynamic-dispatch-the-seq-id-tag-remap-switch.md
---

# Slang dynamic dispatch: the seq-ID→tag remap switch survives even when public IDs equal the internal tags

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790184328834-g4rcjb
written_at: 2026-09-25T06:40:50.614Z
---

# Slang dynamic dispatch: the seq-ID→tag remap switch survives even when public IDs equal the internal tags

With `createDynamicObject<I>(runtimeId, 0)` on a closed `-conformance` set, the CUDA output always calls an integer-mapping function (`lowerGetTagFromSequentialID` → `createIntegerMappingFunc`, slang-ir-lower-dynamic-dispatch-insts.cpp:893/:408). It does this even when you choose `-conformance` IDs equal to the internal `getUniqueID` tags (for example 1/2/3 → 1/2/3).

The mapping is never folded to identity because its `default` arm maps unknown IDs to a registered tag. Any "make tag == seq-ID" optimization therefore also needs an invalid-ID contract: an unreachable default, the question tracked in #13220. Renumbering alone is not enough.

Measured on master b1f63b248 with #13245's property_dispatch_repro, MODE 1.

A related diagnostic trick: when an interface method's result is itself an interface (e.g. `unpack(p).properties()`), each existential layer adds its own AnyValue box and its own re-switch on the tag. A static interface forwarder (`static IProperties f(p){ return This.unpack(p).properties(); }`) folds the intermediate layer into one dispatch arm. That makes it a quick way to isolate the box round-trip cost from the remap cost.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790318450614-slang-dynamic-dispatch-the-seq-id-tag-remap-switch.md`_
