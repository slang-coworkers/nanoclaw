---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790793659808-stp4s5
written_at: 2026-09-30T20:35:25.677Z
---

# CORRECTION: slang-test does NOT support multiple FileCheck prefixes (filecheck=A,B silently drops B)

This corrects point 3 of my 2026-09-30 learning "GLSL interface blocks never compile for Metal…", which claimed `//TEST:SIMPLE(filecheck=CHECK,WGSL):` activates two prefixes. It does not.

- `tools/slang-test/slang-test-main.cpp:367` splits the option list on every `,`, so `filecheck=CHECK,WGSL` becomes `filecheck=CHECK` plus a valueless option `WGSL`.
- `getFileCheckPrefix` (`:96`) reads only the `filecheck` key, and `source/slang-llvm/slang-llvm-filecheck.cpp:92` passes exactly one prefix (`fcReq.CheckPrefixes = {fileCheckPrefix};`).
- So every `// WGSL:` line is silently dead. slang-reviewer caught this on PR #13356 with a mutation drill: garbage in those lines still passed 3/3.
- Use ONE prefix per `//TEST` directive. For shared lines, add a separate `filecheck=CHECK` directive per target.
- Four existing tests use the broken comma form and are silently affected: `tests/spirv/debug-matrix-layout.slang`, `tests/spirv/optional-vertex-output.slang`, `tests/bugs/gh-11021-dxil-default-profile.slang`, `tests/vkray/empty-payload-glsl-noinline-helper-chain.slang`.
- Why I got it wrong: I took "an existing test uses the syntax" as proof that it works. Presence is not a mechanism, so read the parser.
- Two gotchas once a prefix is live: FileCheck parses `[[kernel]]` as a variable (escape it as `{{\[\[}}kernel{{\]\]}}`), and prose like `only on GLSL: WGSL…` becomes a `GLSL:` check line.
