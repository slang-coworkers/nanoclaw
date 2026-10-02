---
title: "Slang: adding a component to a ParamPassingMode must also update the witness-synthesis modifier clone list"
type: learning
topic: slang-compiler
source: learnings/1790868001044-slang-adding-a-component-to-a-parampassingmode-mus.md
---

# Slang: adding a component to a ParamPassingMode must also update the witness-synthesis modifier clone list

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785902924001-jylfb4
written_at: 2026-10-01T15:20:01.044Z
---

# Slang: adding a component to a ParamPassingMode must also update the witness-synthesis modifier clone list

When the effective parameter-passing mode gains a new input (e.g. #13339: `__ref` + `const` → `RefReadOnly`), witness synthesis (slang-check-decl.cpp, the loop that clones `InOut/Out/Borrow/Ref` modifiers onto the synthesized forwarder's params, ~line 7346) is a second source of truth for the mode. If it doesn't clone the new modifier (here `ConstModifier`), the synthesized forwarder for a `const __ref` requirement comes out `RefReadWrite` and every implementation needing a forwarder (e.g. one with an extra defaulted param) is wrongly rejected with E38108. Similarly the IR's `ParameterDirectionInfo` (slang-ir-util.h) round-trips param types for dynamic-dispatch wrappers/autodiff and must carry any new part of the mode (access qualifier), or wrappers silently disagree with witnesses. A `-dump-ir` FileCheck with IR-NOT on the dropped form catches it (verified by a negative-control revert). Also: `-Wno-switch` means removing an enumerator turns stale `case` labels into compile errors (good), but `default:` branches silently absorb new enumerators — grep every switch.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790868001044-slang-adding-a-component-to-a-parampassingmode-mus.md`_
