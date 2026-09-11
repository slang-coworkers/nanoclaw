---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788387468706-vzyn09
written_at: 2026-09-10T21:28:24.249Z
---

# Slang varying-parameter semantics live in TWO representations; intended design is layout-only (per tangent-vector)

Context: shader-slang/slang PR #12885 / issues #12997 (bug) + #12998 (proper-fix design). A Metal mesh-vs-fragment `[[user(...)]]` name mismatch traced to Slang carrying a varying parameter's semantic in **two** places:

1. A **verbatim** `IRSemanticDecoration` attached to IR struct-type *fields* during AST→IR lowering — `addSemanticDecoration(inst, hlslSemantic->name.getContent())` at `source/slang/slang-lower-to-ir.cpp:3235` and `:13034`, storing the source spelling as-written (e.g. `"TEXCOORD1"`, no name/index split).
2. The **normalized** `(name, index)` pair in the entry point's `VarLayout` — `setUserSemantic(semanticName, semanticIndex)` at `slang-lower-to-ir.cpp:16591` (parameter binding uppercases + splits trailing digits before this).

A target-specific IR pass, `fixFieldSemanticsOfFlatStruct` (`slang-ir-legalize-varying-params.cpp:~3800`, run only inside the Metal/WGSL legalization contexts), rewrites the field decorations to canonicalize spelling; paths that bypass it (mesh vertex/prim structs lifted into `metal::mesh<>` by `legalizeMeshStageEntryPoint`) keep the verbatim form → divergence.

**Intended proper design (tangent-vector, maintainer):** semantics should NOT be attached to IR struct fields at all (legacy mis-feature). The entry-point **layout/reflection data is the single source of truth**; flattening/elaboration + normalization of aggregate varyings should happen **early**, where reflection info is produced — not in a late IR legalization pass — and all IR passes + target emitters should read semantics from the layout, not struct fields.

**Semantic rules (tangent-vector):** name = no trailing digit; trailing digits = index; none ⇒ 0; names case-insensitive; indices numeric. `SV_` = system value. **Gotcha: current front-end also treats `NV_` as a system-value prefix** — `slang-parameter-binding.cpp:2021-2024` keys on `sv_`/`nv_`. Don't state "only SV_ is a system value."

**Also:** overlapping/duplicate normalized semantics (`TEXCOORD` + `TexCoord0` → both `("TEXCOORD",0)`) are currently silently re-indexed; maintainers want that diagnosed as an error (with a caveat for targets/features where it's meaningful). Array/struct params auto-assign sequential indices from a "starting semantic" (depth-first); unannotated varyings auto-assign from a `SLANG_ATTR`-like start.
