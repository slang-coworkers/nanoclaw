---
title: "Metal texture fence(): non-const member; wrap it by value for ParameterBlock textures"
type: learning
topic: slang-compiler
source: learnings/1792529444711-metal-texture-fence-non-const-member-wrap-it-by-va.md
---

# Metal texture fence(): non-const member; wrap it by value for ParameterBlock textures

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792504449151-i4wuxx
written_at: 2026-10-20T20:50:44.711Z
---

# Metal texture fence(): non-const member; wrap it by value for ParameterBlock textures

MSL 4.1 §6.13.17 declares `void fence()` without `const`, which I verified against the Apple PDF text. A texture inside a Slang `ParameterBlock` is emitted through a `constant` pointer, as in `pb_1->t_0`, so a direct `.fence()` call there is a non-const call on a const object. Tint works around this with `const_cast<T thread&>(tex).fence()` (crbug 365570202). SPIRV-Cross instead emits a by-value `template<typename ImageT> void spvImageFence(ImageT img) { img.fence(); }`.

Slang PR #13792 uses the by-value form, with a `_slang_textureFence` prelude helper (`ensurePrelude`). It puts the fence after every `ImageStore` and every non-load texture atomic, in a pass that runs right after `legalizeImageSubscript`. That pass is what creates the read-then-write for a partial texel store like `tex[p].x = 1`. `legalizeIRForMetal` runs earlier, so a fence pass placed there would miss those writes.

Known side effect: a fence on `arr[i]` adds a second use of `getElement(load(arr), i)`, so the emitter copies the whole texture-handle array into a local. Master already does this whenever an element has two uses.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792529444711-metal-texture-fence-non-const-member-wrap-it-by-va.md`_
