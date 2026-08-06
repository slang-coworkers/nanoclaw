---
name: project_6540_dxil_deferred_link_scrub
description: "slang#6540 [Modules] DXIL deferred-link scrub ANSWERED (cmt 5197162081) — still relevant, needs reassignment; scope wider than \"mirror"
metadata: 
  node_type: memory
  type: project
  originSessionId: dfe0478a-14a9-4bdd-bf5e-394980f96aa5
---

**slang#6540 — `[Modules] Enable external link option for DXIL shaders`.** Departure scrub requested by
`jkiviluoto-nv` (cmt 5195817502, 2026-08-05 18:40:31Z) because assignee `mkeshavaNV` is out. **ANSWERED**
— cmt **5197162081** (created 20:48:03Z by me, patched 21:06:44Z by slang-triager, 4003→9235 chars,
issue comments 3, botcmts **1** = not stacked). **CHAIN AT REST awaiting a human.** No state changed:
`open`, assignee `mkeshavaNV`, no labels, no milestone.

**Verdict: still relevant, needs reassignment — do not close.** Verified at master `b0e43d657`.

**The gap, measured (not just source-read):** `SkipDownstreamLinking` (`include/slang.h:1192`) has exactly
**one** behavioral consumer — `slang-emit.cpp:3344`, the `spirv-link` gate. Census `shouldSkipDownstreamLinking`
= 3 hits in `source/` (decl `slang-code-gen.h:220`, def `:1417`, that use); non-zero control `shouldDumpIR` = 10.
DXIL path never consults it: `slang-code-gen.cpp:1005-1029` wraps `IREmbeddedDownstreamIR` blobs as
`ArtifactKind::Library` → `options.libraries` (`:1033`) → `compiler->compile(...)` (`:1044`); `grep 'skip'` over
that block = **empty**. No diagnostic either (`slang-diagnostics.lua` → 0, control 667 `err(`).
**3-cell API probe, one harness:** no precompile 3088 B · skip=0 2812 B · skip=1 **2812 B byte-identical,
same DXBC hash**. m0≠m1 proves the precompile fired ⇒ the null is meaningful. Guilty control, SPIR-V same
harness: 772→920 B, gains `OpCapability Linkage` + 2 `LinkageAttributes`.
⚠️ **Mechanism precision:** DXIL does not "unconditionally link" — Slang unconditionally *offers* every blob
as a library and DXC links only when its filtered list is non-empty (`slang-dxc-compiler.cpp:490`, `:714`).
The defect is that nothing lets a caller stop the **offer**.

**Two claims I published and got WRONG** (peer caught both; I re-verified) — see
[[feedback_a_line_range_read_inherits_enclosing_preprocessor_scope]]:
1. "Vulkan sibling live at :260" — **whole file is `#if 0` lines 1→270** (#7577 `43d0c2100`); sibling dead
   too, and the file no longer compiles (7-arg `loadComputeProgram` vs 6-param live overload). The slang-rhi
   port it points at is `#if 0` as well ⇒ the test must be **ported**, not un-commented.
2. Consumer "lost" → **unreachable**: still built/shipped, but `DownstreamLinkMode::Deferred` = **1** hit
   tree-wide (the read, `tools/gfx/renderer-shared.cpp:1166`); setter died with #7577. slang-rhi has **no**
   deferred surface (6 tokens → 0 files; controls 3/14/22), `createShaderModule` takes a **single** blob in all
   6 backends.
⛔ Both errors pushed the estimate toward "small and mechanical" — the direction a maintainer acts on.

**No work to rescue:** `SkipDownstreamLinking` repo-wide = 3 (this, merged precedent **#6500** `cheneym2`
2025-03-05 squash `063468449` first release **v2025.6.2**, unrelated #12355). `mkeshavaNV`: 3 open PRs of 49,
none related; only branch `mkeshava_neural_fix`. ⇒ clean reassignment of the whole task.

**Second unresolved ask on the issue:** `bmillsNV` 2025-05-09 asked for a `[Modules]` parent task — **never
created** (81 `[Modules]` title matches, all individual; modules+epic / modules+tracking → 0). Orphaned live
cluster: **#4846 #6524 #6578 #6607 #9004**, all open, 4 of them in the same departure-scrub batch. Surfaced
to `jkiviluoto-nv` as a decision.

**Residual for a new owner:** decide what "deferred" *means* for DXIL (likely emit unlinked library + app
links via `IDxcLinker`; DXC linking currently lives inside Slang at `slang-dxc-compiler.cpp:717/770/777`),
then thread the skip check into the library-collection site. Prereqs: port the test, add a multi-blob rhi
path. Cheap first step: **diagnose** instead of silently ignoring. GPU-side validation needs D3D12 hardware.

Batch context: [[project_slang_scrub_fanout_22_issues]] · chain survived 3× 429 (fleet-wide, 55 sessions in
8 min). Related: [[feedback_patch_vs_fresh_comment_edit_hides_a_correction]].
