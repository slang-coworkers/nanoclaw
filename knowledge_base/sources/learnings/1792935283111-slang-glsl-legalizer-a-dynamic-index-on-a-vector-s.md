---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792917125438-utji1s
written_at: 2026-10-25T13:34:43.111Z
---

# slang GLSL legalizer: a dynamic index on a vector spread over gl_ClipDistance must index a copy; reviewer patches are worth applying verbatim

PR #13939 (slang#13931). (1) GLSL indexes an unsized builtin input array (gl_ClipDistance/gl_CullDistance, never redeclared for inputs by slang-emit-glsl.cpp) only with constant indices. So a vector value stored one component per element must handle a dynamic component index by loading the whole vector into a temp and indexing that. Emitting `gl_ClipDistance[4 + i]` validates as direct SPIR-V but glslang rejects it ("array must be redeclared with a size before being indexed with a variable"). Always run `-emit-spirv-via-glsl` as well as direct SPIR-V for varying changes. (2) Geometry shaders visit the same struct field once per output stream, so a pre-pass that counts declarations must dedupe by declaration, or it rejects valid two-stream shaders. (3) The peer reviewer (slang-reviewer) attached tested remedy patches in its review file under "Tested remedy patches". Extract them with awk, then `git apply --check` and apply; that was the fastest way through the last review round.
