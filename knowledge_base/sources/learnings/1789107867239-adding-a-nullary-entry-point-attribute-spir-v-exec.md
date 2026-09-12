---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789099035994-krsrai
written_at: 2026-09-11T06:24:27.239Z
---

# Adding a nullary entry-point attribute + SPIR-V execution mode (Slang)

From shader-slang/slang#12999 (`[postdepthcoverage]` → SPIR-V PostDepthCoverage; PR #13001). Mirror `[earlydepthstencil]` end-to-end — the 9 sites: AST node in `slang-ast-modifier.h`; `attribute_syntax` in `core.meta.slang` (`__attributeTarget(FuncDecl)`); IR op in `slang-ir-insts.lua`; stable name in `slang-ir-insts-stable-names.lua`; `isSimpleDecoration` in `slang-ir.cpp`; lowering (`addSimpleDecoration<IR...>`) in `slang-lower-to-ir.cpp`; SPIR-V `Stage::Fragment` funnel in `slang-emit-spirv.cpp`; GLSL `Stage::Pixel` chain in `slang-emit-glsl.cpp`.

Non-obvious rules I confirmed:
- **`ASTNodeType` is NOT append-only.** It is FIDDLE-regenerated from declaration order each build; group a new attribute next to its sibling by category (do NOT hunt for "the end"). Cross-version module compat is handled by the module-version gate, not AST declaration order. (Codex will call insertion a "renumbering blocker" — it's a false positive; there's no append-only rule for AST nodes, unlike `include/` enums and IR stable-names.)
- **A new IR instruction DOES require bumping `k_maxSupportedModuleVersion` (slang-ir.h)** — the in-header comment says so explicitly. Separate from the stable-name table (which fixes the op's serialized id). This forces a wide rebuild (header is included everywhere) — batch it with other changes.
- **`requireSPIRVCapability(SpvCapability)` is a pure emission funnel** (adds `OpCapability`, no capdef-atom lookup). You do NOT need `slang-capabilities.capdef` atoms just to emit a capability+extension+mode. `[earlydepthstencil]` uses none. capdef atoms are a separate front-end (profile/availability) concern. Adding them pulls in doc regeneration + the capgen internal/external-pair validation — skip unless you actually need front-end capability gating.
- **PostDepthCoverage requires EarlyFragmentTests** per the SPIR-V spec; auto-emit both (the `requireSPIRVExecutionMode` funnel dedups, so pairing with `[earlydepthstencil]` is safe). NOTE the vendored spirv-val (`validate_mode_setting.cpp`) only checks the Fragment execution model for PostDepthCoverage — it does NOT enforce the EarlyFragmentTests pairing, so this is spec-conformance, not passing validation.
- **GLSL: `GL_ARB_post_depth_coverage` implies early_fragment_tests** (glslang sets it automatically, no error). The stricter `GL_EXT_post_depth_coverage` *requires* explicit `early_fragment_tests` and errors without it. glslang's reference SPIR-V (`external/glslang/Test/baseResults/spv.arbPostDepthCoverage.frag.out`) emits both modes + capability + OpExtension.
- **Metal DOES have post_depth_coverage** (SPIRV-Cross `main` emits it on the `[[sample_mask]]` input, MSL 2.0/macOS 2.3, needs separate `[[early_fragment_tests]]`), but it's on the input param (extra plumbing) — HLSL/DXC has none. Don't claim "no Metal primitive"; say "deferred".

Test pattern: `//TEST:SIMPLE(filecheck=CHECK): -target spirv` disassembles for FileCheck. CHECK-DAG and CHECK-COUNT-N are supported. To assert "emitted exactly once" (dedup), use `COUNT-1:` + a following `-NOT:` of the same pattern (COUNT-1 alone does NOT catch a duplicate). Add a negative CHECK-NOT test (entry point without the attribute) — precedent `tests/spirv/shader-64bit-indexing-negative.slang`.

Ops gotcha: `git add -A` keeps re-committing `build.log`/`configure.log` from the worktree build; stage specific files or delete the logs first (`.git/info/exclude` fails in a worktree — `.git` is a file, not a dir).
