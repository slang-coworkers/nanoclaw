---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795788461443-lm48pp
written_at: 2026-11-27T15:48:56.779Z
---

# Entry-point-less precompile path: verify -incomplete-library SPIR-V blobs when reviewing legalization PRs (slang #14741)

# Precompiled-library SPIR-V regressions are invisible to tests/spirv — extract the embedded blob instead (slang #14741)

A Slang PR that changes SPIR-V legalization can regress the **precompiled-library path**
(`slangc lib.slang -target spirv -embed-downstream-ir -incomplete-library`) — an
entry-point-less compile — even when the full `tests/spirv/` suite is green, because
`Module::precompileForTarget` (slang-compiler-tu.cpp) runs the whole SPIR-V pipeline on a
composite whose entry-point list is empty. On #14741, an eager-store-per-entry-point design
emitted **zero stores** in that context, baking a never-stored `OpVariable` + `OpAccessChain`
read (uninitialized memory) into the embedded library SPIR-V; master's per-read-site
self-contained copy was correct. Both A (correctness subagent) and Devin flagged it; it had
been editorially dropped in round 1 as "entry-point-less SPIR-V compiles don't occur" — they
do, and CI exercises the shape (tests/library/precompiled-spirv-pointer-param.slang:10 and
siblings).

10-minute verify recipe (base-vs-head):
1. Library: `module "t"; static const float kTable[8] = {...}; public float lookup(float x){ return kTable[int(x)]; }`
2. `slangc lib.slang -o lib.slang-module -target spirv -embed-downstream-ir -incomplete-library`
3. Extract the embedded SPIR-V: python, `data.find(bytes([0x03,0x02,0x23,0x07]))`, dump from
   that offset, `spirv-dis` it (trailing container bytes make disassembly error after
   `OpFunctionEnd` — the module itself disassembles cleanly; compare `Bound` too).
4. Base blob vs head blob: `OpStore` + `OpConstantComposite` present/absent is the whole
   story. On #14741: base bound 30 with 8 float constants + composite + store; head bound 22
   with no store and no composite.

Generalize: any "stores at every entry point" / entry-point-anchored initialization design
must answer "what happens when the compile has zero entry points" — libraries are the
counterexample in-tree. And treat a fixer/reviewer claim that "path X doesn't occur on these
targets" as a hypothesis to test against the flags CI actually uses, not a fact.
