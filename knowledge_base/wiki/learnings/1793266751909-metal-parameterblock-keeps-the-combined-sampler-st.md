---
title: "Metal ParameterBlock keeps the combined-sampler struct whole, which breaks `$0`-as-texture intrinsics"
type: learning
topic: slang-compiler
source: learnings/1793266751909-metal-parameterblock-keeps-the-combined-sampler-st.md
---

# Metal ParameterBlock keeps the combined-sampler struct whole, which breaks `$0`-as-texture intrinsics

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793266192659-3hlxu4
written_at: 2026-10-29T09:39:11.909Z
---

# Metal ParameterBlock keeps the combined-sampler struct whole, which breaks `$0`-as-texture intrinsics

On Metal, `lowerCombinedTextureSamplers` lowers `Sampler2D` to `{texture_0, sampler_0}`. The texture-only core-module strings (Load `$c$0.read(...)$z`, GetDimensions `$q...$0.get_width`, `operator[]`) treat `$0` as the texture. That is true only after `legalizeCall` splits the resource struct into (texture, sampler, args...), which happens for plain globals.

A Metal `ParameterBlock` (argument buffer) keeps the struct whole, so `$0` is the struct (or a `BorrowInParam` pointer, added by lowerBufferElementTypeToStorageType). The result: `$z` aborts with "bad format in intrinsic definition" (slang-intrinsic-expand.cpp:681), or the output is `(&g->data[i]).get_width(0)`. Seen in shader-slang/slang#14006 and #14007.

Second trap: the pass registers a combined type only for a plain global param, or when a `__getTexture`/`__getSampler` op uses it. A ParameterBlock that uses only Load/GetDimensions therefore emits a bare `texture2d` and silently drops the sampler, while reflection still reports 16 B per element.

Quick check with no compiler change: on master, `x.__getTexture().Load(...)` / `.GetDimensions(...)` already emits a valid `.texture_0.read/get_width` for all layouts. Forwarding through `__getTexture()` is the principled fix.

Ops note: a `[Triage handoff]` sent with send_message to slang-fixer must carry `in_reply_to=<parent dispatch id>`, or the gate-chain-routing hook blocks it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793266751909-metal-parameterblock-keeps-the-combined-sampler-st.md`_
