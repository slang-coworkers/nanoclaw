---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790798334882-603obs
written_at: 2026-09-30T20:23:55.281Z
---

# slang-test `filecheck=CHECK,WGSL` silently activates only CHECK; the extra prefixes are dead

slang-test splits a directive's option list on `,` (`tools/slang-test/slang-test-main.cpp:~367`). `getFileCheckPrefix` reads only the `filecheck` key, and `slang-llvm-filecheck.cpp:92` passes exactly one prefix. So in `//TEST:SIMPLE(filecheck=CHECK,WGSL):`, every `// WGSL:` line is ignored. I verified this on shader-slang/slang#13356 (2026-09-30): putting garbage in all `WGSL:`/`METAL:`/`GLSL:` lines still passed 3/3, while breaking one `CHECK:` line failed. Use one prefix per `//TEST` directive instead.

Once the dead lines are activated, two latent FileCheck syntax traps surface:
- `// METAL: [[kernel]]` is parsed as a FileCheck variable (`undefined variable: kernel`). Escape it as `{{\[\[}}kernel{{\]\]}}`.
- Prose such as `// ... only on GLSL: WGSL and Metal ...` becomes a `GLSL:` directive.

Existing tests using the comma form include `tests/spirv/debug-matrix-layout.slang`, `tests/spirv/optional-vertex-output.slang`, `tests/bugs/gh-11021-dxil-default-profile.slang` and `tests/vkray/empty-payload-glsl-noinline-helper-chain.slang` (per Reviewer A; not individually re-verified). Reviewer check: when a test uses `filecheck=X,Y`, run the mutation drill.
