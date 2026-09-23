---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790001240540-r0h99o
written_at: 2026-09-22T18:08:07.907Z
---

# Testing that link-time downstream args affect getEntryPointHash — avoid spurious-miss args

When writing a unit test that asserts a link-time option changes `IComponentType::getEntryPointHash` (the shader-cache key), the test only builds the SHA digest — it never invokes the downstream compiler. So ANY differing option string makes the hash differ, and a naive test passes even when the two option sets would produce IDENTICAL generated code. That is a *spurious miss*: it enshrines a cache miss that a correct/optimized hash could legitimately avoid, and it does not prove the intended contract ("codegen-affecting options change the key"). Reviewers (and codex, which actually compiles) will catch this.

To make the test faithful, the toggled option must (a) be passed through to the downstream tool UNMODIFIED by Slang, and (b) actually change codegen FOR THE TEST FIXTURE. Pitfalls found on shader-slang/slang#13197 / PR #13215:
- `nvrtc --gpu-architecture=compute_75` vs `compute_120`: CLASHES with the `-arch=compute_*` Slang injects unconditionally (`slang-nvrtc-compiler.cpp` ~1349-1356; DownstreamArgs are appended AFTER it ~1382-1387 with an explicit "if these clash compilation might fail" note). Bad.
- `dxc -Od` vs `-O3`: Slang appends its default optimization arg (`-O1`) AFTER compilerSpecificArguments (`slang-dxc-compiler.cpp` ~535-543 then ~598-611); DXC honors the LAST opt flag, so both collapse to `-O1` → identical DXIL. Bad.
- Good pairs (passed through, not overridden): nvrtc `--fmad=false` vs `--fmad=true` (FMA contraction) — but ONLY if the fixture has a FLOAT multiply-add (`a*b+c`); an integer-only shader emits identical PTX either way. And dxc `-Gfa` vs `-Gfp` (flow-control strategy) — needs a data-dependent branch in the fixture, and `-Gfa` on SM 5.1+ additionally requires `-all_resources_bound` to compile.
- Non-DownstreamArgs coverage: `VulkanBindGlobals` (Int2, index+set) on a SPIRV target changes the binding — a genuine codegen input consumed by Slang's own SPIR-V layout (not forwarded to a downstream tool).

Mechanics: a single `DownstreamArgs` argline is split into individual args on NEWLINE, not spaces (`CommandLineArgs::deserialize` → `StringUtil::split(content, '\n', ...)` in `slang-command-line-args.cpp`), so to pass two dxc args in one entry use `"-Gfa\n-all_resources_bound"`. `DownstreamArgs` is an array option (accumulates). `CompilerOptionSet::buildHash` hashes the option set apart from its explicit exclusions (e.g. CoverageManifestOutput, SeparateDebugInfoOutput, UseUpToDateBinaryModule) — don't call them all "output-only".

For a Module, its option set is reached by THREE distinct hashing paths in getEntryPointHash: `getLinkage()->buildHash` (also hashes the target set), `Module::buildHash`→`computeDigest`, and the new `getOptionSet().buildHash` — redundant but deterministic; extra bytes can only add a cache miss, never a false hit.

Meta-lesson: give a hash/codegen test a DEDICATED fixture that exercises exactly the features the toggled options affect, rather than reusing a generic trivial shader; and let codex compile the candidate args to each target to confirm the output genuinely differs before claiming it.
