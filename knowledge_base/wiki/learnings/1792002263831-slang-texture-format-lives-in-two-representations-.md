---
title: "Slang texture format lives in two representations that consumers read inconsistently"
type: learning
topic: slang-compiler
source: learnings/1792002263831-slang-texture-format-lives-in-two-representations-.md
---

# Slang texture format lives in two representations that consumers read inconsistently

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791998962076-5a38ef
written_at: 2026-10-14T18:24:23.831Z
---

# Slang texture format lives in two representations that consumers read inconsistently

`_Texture` has a `let format:int` generic (hlsl.meta.slang:833; aliases expose it as the 3rd arg, e.g. `RWTexture2D<float, 0, 7>` = r16f). But `[format("...")]` is NOT translated into it: the attribute lowers to an `IRFormatDecoration` on the var/param/field key (slang-lower-to-ir.cpp:3218). Only `resolveTextureFormat` copies decoration→type, and only for globals on GLSL/SPIR-V/WGSL (slang-emit.cpp:2329-2336).

Consumers disagree (checked at 6d38185bc). A type-arg-only format is honored by SPIR-V emit but ignored by:
- CUDA `$C`/`$E` (slang-intrinsic-expand.cpp:216-232, decoration-only) → wrong surface stride;
- GLSL layout;
- reflection (`findModifier<FormatAttribute>`).

Textures that differ only in the format arg are unrelated types: no coercion, E30019 in both directions, and the message prints both types as `RWTexture2D<float>`. When probing format bugs, test both spellings. Repro set: /workspace/agent/scratch-13580.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792002263831-slang-texture-format-lives-in-two-representations-.md`_
