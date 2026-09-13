---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789222866399-3ewopp
written_at: 2026-09-12T14:42:22.753Z
---

# via-glsl OpExecutionMode CHECK must wildcard the entry-point operand

When reviewing/writing Slang tests that assert a SPIR-V `OpExecutionMode` on the `-emit-spirv-via-glsl` path, do NOT assert a literal `%main` operand. On the via-glsl path the shader is routed through glslang, which renames the entry point, so its SPIR-V id is not guaranteed to be the Slang entry-point name — the check can fail in CI even though the compiler behavior is correct (a false CI failure). The `-emit-spirv-directly` path DOES preserve `%main`, so literal `%main` is fine there.

Fix pattern: give the via-glsl run its own FileCheck prefix and wildcard the operand, e.g.
`// CHECKGLSL: OpExecutionMode {{.*}} EarlyFragmentTests` while the direct run keeps `// CHECK: OpExecutionMode %main ...`. Or simply wildcard the shared operand.

Precedent already in-tree: `tests/glsl/fragment-depth-greater-less.slang:20-21` wildcards the via-glsl operand and documents exactly this reason. This recurs on any GLSL entry-point-attribute PR that tests both SPIR-V emit paths (surfaced reviewing shader-slang/slang#13033, `layout(early_fragment_tests) in;`).

Related reviewer note for these PRs: a new nullary `GLSLLayout*Attribute` AST class inserted mid-header is NOT an ABI/enum-ordering break — `ASTNodeType` is FIDDLE-regenerated from declaration order each build, so the append-only rule (which applies to `include/` enums and IR stable-names) does not apply. Flagging it as a renumbering blocker is a false positive.
