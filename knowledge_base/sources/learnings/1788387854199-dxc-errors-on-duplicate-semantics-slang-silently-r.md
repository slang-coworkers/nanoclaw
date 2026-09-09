---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788387468706-vzyn09
written_at: 2026-09-02T22:24:14.199Z
---

# DXC errors on duplicate semantics; Slang silently re-indexes them

**Question that recurs:** what happens when the same user semantic + index is used twice (e.g. `TEXCOORD` and `TEXCOORD0` on distinct varyings)?

**HLSL rule:** an *unindexed* semantic has an implicit index of 0, so `TEXCOORD` ≡ `TEXCOORD0`. Two fields on the same `(base, index)` are a genuine duplicate; distinct indices (`TEXCOORD0`/`TEXCOORD1`) are fine.

**DXC behavior (verified via source inspection on microsoft/DirectXShaderCompiler, not a live run):**
- DXIL/native (D3D): duplicate `(name,index)` fails validation. DXC's SROA-parameter pass comment gives the exact example `main(float a:TEXCOORD0, float b:TEXCOORD1, float bar:TEXCOORD0)` → "will later on fail validation due to duplicate semantics." `Semantic::DecomposeNameAndIndex` normalizes `TEXCOORD`→(TEXCOORD,0), so unindexed-vs-explicit-0 doesn't slip past.
- SPIR-V (Vulkan): explicit diagnostic `DeclResultIdMapper::checkSemanticDuplication` → `"output semantic '%0' used more than once"` (and `input` variant).

**Slang behavior (current, HEAD ~2026-09):** NO duplicate-user-semantic diagnostic. The overlap is silently legalized — `fixFieldSemanticsOfFlatStruct` (`source/slang/slang-ir-legalize-varying-params.cpp:3799`) calls `_returnNonOverlappingAttributeIndex` (`:3707`) to bump the colliding field to a free index (`BAR`+`BAR0` → `BAR`/`BAR_1` on Metal). Only system-value duplicate diagnostics exist (`MultipleDepthOutputSemantics` etc. in `slang-check-shader.cpp`). Semantic base/index split helpers: `splitNameAndIndex` (`slang-parameter-binding.cpp:488`) and `decomposeSimpleSemantic` (`:1960`).

**Design takeaway if asked "should Slang error too":** worth surfacing (silent re-index masks a likely typo and diverges from DXC), but (a) front-end/target-independent so all backends agree, (b) only for true `(base,index)` collisions, (c) a hard error is a **breaking change** — silent legalization has shipped for non-mesh stages and tests rely on it — so a warning first is the safe non-breaking step.

**Ops note:** `gh auth status` reports the nv-slang-bot App token as "invalid" and `gh api user` returns 403 "Resource not accessible by integration" — both are normal for a GitHub App installation token and do NOT mean posting fails. `gh pr comment` works fine.
