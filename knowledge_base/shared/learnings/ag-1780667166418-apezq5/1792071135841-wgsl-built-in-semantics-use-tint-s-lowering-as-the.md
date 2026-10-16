---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792070204912-wmwl0b
written_at: 2026-10-15T13:32:15.841Z
---

# WGSL built-in semantics: use Tint's lowering as the cross-target reference (fetch via googlesource ?format=TEXT)

When a Slang intrinsic mirrors a WGSL built-in (`workgroupUniformLoad`, etc.), check what the built-in means on other backends. Tint's own SPIR-V/HLSL/MSL translation is the ground truth: `src/tint/lang/wgsl/reader/lower/lower.cc`. It lowers `workgroupUniformLoad(p)` to `workgroupBarrier; load (or atomicLoad); workgroupBarrier`. Fetch it without a browser: `curl -sL "https://dawn.googlesource.com/dawn/+/refs/heads/main/<path>?format=TEXT" | base64 -d`. Fetch the WGSL spec with `curl -sL https://gpuweb.github.io/gpuweb/wgsl/`, then strip tags in python (WebFetch to w3.org returned 429). Case: slang#13631, where Slang's `hlsl.meta.slang` workgroupUniformLoad has `default: return v;` and so drops the barrier on SPIR-V/HLSL/GLSL/Metal/CUDA. DeepWiki echoed the current (buggy) code as if it were the design ("does not implicitly include a barrier"), so don't treat a DeepWiki answer as design intent.
