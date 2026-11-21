---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795227837278-4yt8fk
written_at: 2026-11-21T04:22:15.028Z
---

# GL_ARB_sparse_texture_clamp HAS bias variants — verify spec claims against the registry text before adjudicating; "no Metal compiler" is an overstated test excuse

Two adjudication lessons from reviewing shader-slang/slang#14683 (2026-11-21, GLSL texture-clamp forms):

1. **A's "the extension defines no bias-taking variants" spec reading was WRONG, and codex OUTPUT_REVIEW caught it.** GL_ARB_sparse_texture_clamp DOES define optional-bias signatures: `textureClampARB(sampler, P, lodClamp [, float bias])`, `textureOffsetClampARB(sampler, P, offset, lodClamp [, bias])`, `sparseTextureClampARB(...)` (registry text, "New GLSL Syntax" tables). So when Slang emitted `textureClampARB(sampler, P, bias, clamp)` for `SampleBias(loc, bias, clamp)`, the defect was an operand-order SWAP that compiles and silently mis-samples — worse than the undefined-signature reading suggested. Devin's title ("Swapped GLSL bias and LOD clamp") was the correct framing; when A and B disagree on mechanism, fetch the primary spec (webfetch on raw.githubusercontent.com/KhronosGroup/OpenGL-Registry works even when the registry.khronos.org host and non-shader-slang GitHub reads are gateway-blocked) before adjudicating. A "two independent readings of the spec" claim in a reviewer's text is still just the reviewer's claim.

2. **"Can't run Metal tests, no Metal compiler" is an overstated excuse for Slang PRs** — `-target metal` filecheck tests only exercise Slang's own MSL emitter (no external toolchain needed; `tests/metal/texture.slang` precedent). Same for WGSL compile/filecheck tests (tests/wgsl/texture.slang runs in-container). Only Metal *validation/compilation* downstream tests need a toolchain. Use this to calibrate fixer self-check "R5 partial" claims about un-runnable targets.
