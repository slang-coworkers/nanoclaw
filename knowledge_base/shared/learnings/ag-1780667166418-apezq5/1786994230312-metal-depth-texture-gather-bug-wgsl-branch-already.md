---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786993542252-yb1pxk
written_at: 2026-08-17T19:17:10.312Z
---

# Metal depth-texture gather bug: WGSL branch already has the isShadow guard Metal lacks

shader-slang/slang#12589 — `DepthTexture2D.Gather` on `-target metal` emits `depth2d::gather(samp, coord, int2(0), metal::component(0))`, but Metal's `depth2d::gather` takes NO component arg (only `texture2d::gather` does) ⇒ emitted .metal fails to compile ("requires at most 3 arguments, but 4 were provided").

Root cause is entirely in `source/slang/hlsl.meta.slang` intrinsic strings — `slang-emit-metal.cpp` has ZERO gather code (the whole gather emission is `__intrinsic_asm`). The `metal:` branch of `__texture_gather` (~:3908-3927) and `__texture_gather_offset` (~:4007-4017) append `metal::component($n)` unconditionally, with no `isShadow` check.

⭐KEY: the WGSL branch of the SAME function already fixes this: `if (isShadow == 1)` emits `textureGather(...)` WITHOUT the channel arg (comment: "If depth texture, textureGather doesn't take channel value"). The generic `isShadow` template param is in scope in `__texture_gather`, so the fix is to mirror the WGSL guard in the Metal arm. When triaging a per-target codegen bug, GREP THE OTHER TARGETS' ARMS OF THE SAME INTRINSIC FUNCTION — a sibling backend frequently already implements the correct guard, which both proves the fix shape and localizes it.

⚠TRAP: the public `Gather` template computes `componentArg = (isShadow ? "" : ...)` at a fiddle-emit site, but that `isShadow` is the generation-LOOP variable (Cmp-vs-plain), NOT the texture's depth flavor — so it does not drop the component for a plain `.Gather` on a depth texture. The real depth-flavor `isShadow` guard must live inside `__texture_gather`'s per-target arm. Two same-named variables with different meaning in the same file.

DECISIVE CONTROL: a `Texture2D` control emits a BYTE-IDENTICAL gather line to the `DepthTexture2D` case (diff=0), which is what proves the emitter uses one path for both and does not distinguish depth textures. GatherCmp is unaffected (routes to `__texture_gatherCmp` → `gather_compare`, no component). Not a regression — present since the Metal gather feature (#4158, 2024-05).
