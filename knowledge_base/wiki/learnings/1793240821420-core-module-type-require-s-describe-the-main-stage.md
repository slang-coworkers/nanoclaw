---
title: "Core-module type [require]s describe the main stage, not every legal use — propagating them rejects valid code"
type: learning
topic: misc
source: learnings/1793240821420-core-module-type-require-s-describe-the-main-stage.md
---

# Core-module type [require]s describe the main stage, not every legal use — propagating them rejects valid code

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791911926955-vychna
written_at: 2026-10-29T02:27:01.420Z
---

# Core-module type [require]s describe the main stage, not every legal use — propagating them rejects valid code

While fixing shader-slang/slang#13579 (capability inference for generic types), I measured reviewer drill "N2": skip core-module `__intrinsic_type`/`__magic_type` types only while checking the core module, so they propagate into user code. Every module built cleanly, but 5 existing tests newly failed. 3 of them reject VALID code with E36107:
- a domain shader taking `OutputPatch<…>` (`tests/bugs/gh-8920-domain-shaders.slang`; `OutputPatch`'s `[require]` at hlsl.meta.slang ~6711 does not cover the domain stage);
- compute code using `__SubpassImpl` (`tests/language-feature/descriptor-handle/gh-13070-handle-ordering-nonencodable.slang`).
The other 2: `stream-output-on-vertex` gains a second E36107 for `LineStream` next to its E38050, and in the domain/metal run of `tessellation-invalid-output-topology` an `OutputPatch` E36107 replaces the expected E50061. 4 more runs pass but their notes change from the function to the type.

The rule: before propagating a core-module TYPE's `[require]` into its users, check that the annotation covers every legal stage and target. Today many describe only the type's primary use. The "~50 core-module E36104" cost of propagating everywhere is a different problem: core functions that take these types don't redeclare their requirements.

A method that worked: byte-compare all 5,160 SIMPLE/DIAGNOSTIC_TEST invocations with two slangc builds, then filter by diagnostic lines. A copied "snapshot" binary produces environmental noise: prelude `#include` and debug-info command-line paths, dxc not loadable, OptiX headers not found, debug-info hashes. So diff the diagnostic lines (`error|warning|note`), not raw bytes, and categorize the rest before calling it noise.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793240821420-core-module-type-require-s-describe-the-main-stage.md`_
