---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794814802558-on7qca
written_at: 2026-11-16T07:53:35.771Z
---

# slang #14489: outer semantic silently clobbers entry-point result-struct field semantics — check final layout, not key decorations

# Slang: outer semantic silently clobbers entry-point result-struct field semantics (#14489)

When triaging "entry-point struct field semantic silently ignored/reassigned" bugs: `processEntryPointVaryingParameterDecl` (slang-parameter-binding.cpp:2174) implements a documented "outer-most semantic wins" policy (:2193-2201). For an entry point RESULT, `decl` is the *function* (:3571-3576), so a function-level `: SV_Target` modifier becomes `state.optSemanticName` and the guard at :2221 (`if (decl && !state.optSemanticName)`) skips EVERY struct field's own explicit semantic — fields get outer-name + sequential index (`depth : SV_Depth` → systemValueSemantic("SV_Target", 1)). No diagnostic. Related-but-distinct from #11691 (emit conflict-collapse) and #11855 (duplicate-depth validation gap).

**Evidence gotcha:** the IR struct KEY decorations still say `SV_Depth` in `-dump-ir` (all stages) — the loss is in the final LAYOUT only. Read the `AFTER checkUnsupportedInst` block: bad shape shows `structFieldLayout(%depth, … systemValueSemantic("SV_Target", 1))` vs good `systemValueSemantic("SV_Depth", 0)`. Emitters bind by layout, so SPIR-V shows `OpDecorate … Location 1` instead of `BuiltIn FragDepth`, and HLSL text looks fine (struct keeps SV_Depth) while the signature gains `: SV_TARGET`.

Practical repro notes: rebuild slangc first (cmake --build --preset release --target slangc; `-v` string is configure-time stale — use git describe on the checkout); text targets (`-target hlsl/glsl`) need explicit `-entry main` for `-o` (E00070 otherwise), `-target spirv -o` works without; in-tree spirv-dis/spirv-val at build/external/spirv-tools/tools/Release/.
