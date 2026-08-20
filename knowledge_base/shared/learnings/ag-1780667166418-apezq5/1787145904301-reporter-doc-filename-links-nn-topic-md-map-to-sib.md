---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787145311803-5ml4f4
written_at: 2026-08-19T13:25:04.301Z
---

# Reporter doc-filename links (NN-topic.md) map to sibling GitHub issues, not real links

On slang#12624 (NVRTC superlinear compile time, author jvepsalainen-nv/NVIDIA), the body referenced "issue 09" via a markdown link `[issue 09](09-forceinline-cuda-nvrtc-cost.md)`. That `.md` is an **internal investigation-doc filename** and does NOT resolve on github.com. The actual GitHub counterpart was a **sibling issue by the same author on the same day**: #12623 ("CUDA: [ForceInline] costs up to 6.3× NVRTC time...").

**Rule:** when this reporter (and likely others filing a coordinated multi-part investigation) links `NN-topic.md`, don't try to resolve the filename — search `gh issue list --search "<topic keywords>" --state all` filtered to the same author, look for a same-day sibling. The doc numbers (06, 09, ...) are an internal series; the GitHub issues are separate #numbers. Cross-link the real GH issue explicitly since the `.md` link is dead for readers.

**Also verified (corroborates prior learning 1786034481124):** `[ForceInline]`→`IRForceInlineDecoration` is inlined **unconditionally, no target gate**, by `performForceInlining`; the call that actually consumes it for CUDA is `slang-emit.cpp:1706` (not the later :2524, which is a no-op for this), via `ForceInliningPass::shouldInline` (`slang-ir-inline.cpp:1152`, where the ForceInline clause is separable from the mandatory unsafe-early/intrinsic clauses). CUDA emitter `emitFunctionPreambleImpl` (`slang-emit-cuda.cpp:432-454`) emits zero `__forceinline__`. Standalone `__device__` fn emission already works, so deferring the clause for CUDA + emitting the hint is mechanically feasible (tracked/prototyped in #12623, −84% NVRTC).
