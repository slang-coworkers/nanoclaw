---
name: RESOLVED #11825 E31106/E31107 on entry-point params — fixed by #11986
description: Diagnostic-quality bug; fixed upstream by PR #11986 (merged 2026-07-10) via our recommended A/C approach; verify our fixer draft closed
type: project
originSessionId: 97eaa1c9-c1a5-4cc1-8593-3e7cebf3fc66
---

**RESOLVED 2026-07-10 (comment 4957707085).** expipiplus1: fixed by **PR #11986 (merged 2026-07-10)** — exactly our recommended A/C: E31106/E31107 suppressed for compiler-synthesized parameter groups (`ConstantBuffer<EntryPointParams>`/`ConstantBuffer<GlobalParams>`, marked with new `SynthesizedParameterGroupDecoration`); still warns on user-authored `ConstantBuffer<S>`. zangold-nv intent concern resolved in that PR's review. Issue being closed (auto-close linkage didn't fire). **Fix landed via SEPARATE PR #11986, not our fixer draft** — routed to triager→fixer to confirm/close any open `fix/issue-11825` draft as superseded. Never received report_pr_created, so unsure a draft exists. History below.

---
shader-slang/slang#11825 (opened 2026-06-29 by skallweitNV, collaborator; labels RTR, Type=Bug). `slangc -entry testMain -target hlsl|spirv` on a compute entry point mixing `Texture2D`/`RWTexture2D` + `uniform int2 dim` emits E31106 ×1 + E31107 ×2 with **no source location**.

**Reproduced at HEAD (502f1a8d9)** by slang-triager; `reproduced` label applied. Verified 5-bullet posted on issue (comment 4834879711).

**Root cause:** entry-point uniform+resource params collected by CollectEntryPointUniformParams (slang-ir-entry-point-uniforms.cpp:526-576) into a synthesized struct wrapped in ConstantBuffer<> (because `uniform int2` is ordinary data); type legalization (slang-legalize-types.cpp:1237-1267) sees textures leak out and warns. Synthesized type has no loc + synthesized uses → findFirstUseLoc empty → no file:line. An explicit user ConstantBuffer<S> with mixed members DOES warn with a location.

**Two reporter concerns:** (1) no source loc → confusing; (2) **questions whether the warning is useful at all** for entry-point params (separate slots in HLSL is a given).

**Solution space (triager memo):** A/C = restrict E31106/E31107 to source-authored groups (mark synthesized struct, skip diagnose at legalize site) — resolves BOTH concerns, matches warning's original intent (PR #10158 = user-authored cbuffer/push_constants). B = location-only (resolves #1 only, leaves usefulness objection).

**Status 2026-06-29: triager dispatched fixer for a DRAFT-to-confirm (peer-wired handoff); Main endorsed.** Concern #2 is a maintainer design call. Draft PR treated as **confirmation vehicle** (concrete change for maintainers to react to), NOT a merge candidate. Constraints to triager: draft must pose suppress(A/C)-vs-locate(B); **hold for review — no ready-flip/merge**; fixer MUST call `report_pr_created` (load-bearing — maintainer replies arrive as GitHub webhooks and must route back to the fixer's session). Triage memo file: /workspace/inbox/a2a-1782751274552-ajshp8/triage-11825.md.

**UPDATE 2026-06-29 (comment 4834946676): skallweitNV AGREES with A/C** ("not warning on synthesized structs of entry-point parameters") — direction validated, de-risks the draft. **BUT defers to @zangold-nv** on whether it matches the original-warning intent (zangold-nv likely owns PR #10158); cc'd @expipiplus1. **NOT full convergence yet** — still need zangold-nv (intent owner) + expipiplus1. Routed down to triager→fixer on canonical thread: proceed with draft as confirmation vehicle, keep DRAFT, draft must explicitly ask zangold-nv/expipiplus1 to confirm intent. Release-to-ready only on zangold-nv sign-off.
