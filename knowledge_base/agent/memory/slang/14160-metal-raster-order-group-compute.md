---
type: chain
title: slang#14160 — Metal emits `[[raster_order_group(0)]]` on a ROV in a compute kernel
description: Human-filed (albertrodriguezclo) Metal bug 2026-11-02 10:04:38Z. Every RasterizerOrdered* param gets `[[raster_order_group(0)]]` whatever the stage; Apple's compiler rejects it in a `[[kernel]]` (slangc returns 0). Dispatched to slang-triager under the R6 hold (to 2026-11-06T10:04:38Z). Main one-shot r6-release-14160-aa3d at 11-06 10:08Z. Triaged 10:32Z bug/medium/P2 (Metal emit: emitPostDeclarationAttributesForType has no stage check; rec plain device buffer outside fragment). Side bug #14166 (ROV in ParameterBlock loses the attribute) owned here. No fixer; operator asked.
tags: [metal, emit, rov, rasterizer-ordered, compute, bug, r6]
---

# slang#14160 — `raster_order_group` on a compute-kernel ROV (Metal)

**Ask.** `RasterizerOrderedStructuredBuffer<int> rov;` used from `[numthreads(1,1,1)] computeMain` emits
`int device* rov_1 [[raster_order_group(0)]] [[buffer(0)]]` in a `[[kernel]]`. Apple `metal -std=metal3.1` fails with
"invalid 'raster_order_group' attribute for input declaration in a kernel function"; slangc returns 0. The same
attribute compiles in a fragment function. Expected: emit the attribute only for fragment entry points; elsewhere,
either a plain `device` buffer (HLSL allows ROV in compute with RW semantics) or a fragment-only diagnostic. The
repo test `tests/language-feature/pointer/get-address-buffer-element-ordered.slang` emits this MSL but has no Metal
lane. Toolchain: master `6815ed82d`, macOS 26.7.1, Xcode 26.5, Apple M4.

**Related.** [#13796](../imported/project_13796_rasterizer_ordered_buffer_write_only_access.md) (ROV buffer typealias
gets write-only access on every target; maintainer-owned, jhelferty-nv self-assigned 10-21). Same resource family, a
different defect, so not a dup. GitHub search for `raster_order_group`: only #14160 and #13796.

**Reporter pattern.** albertrodriguezclo often opens their own fix PR soon after filing (#14010→#14011 in 38 min,
#13906→#13907). If they do, the bot chain stands down (precedent [14010](../imported/project_14010_metal_device_memory_barrier_scope.md)).

**Dispatch (11-02 10:06Z, Orchestrator).** Memory grep on 14160: no chain hit. Only session on
`gh-issue-shader-slang/slang-14160` is my own webhook session `sess-1793613879797-4n1pp1`. Labels none, 0 comments; a
fenced compiler error but no crash word, no `bot-ok` → **R6 hold until 2026-11-06T10:04:38Z**: no bot comment, label,
PR, or commit naming the issue. Release timer: Main's `r6-release-14160-aa3d` (11-06 10:08Z); the triager was told not
to set its own.

**Progress 11-02 10:09Z (slang-triager).** Reproduced on master 6815ed82d from the emitted MSL. Compute **and vertex** both get
`[[raster_order_group(0)]]`; SPIR-V already degrades a ROV to plain storage in compute. The triager is tracing the emit site and
writing the held draft.

**Triaged 11-02 10:32Z (slang-triager).** bug / medium / P2 / Metal emit. Not a regression (logic from #4175, 2024-05),
not a dup. Memo: `/workspace/inbox/a2a-1793615564219-jlv0b9/triage-14160.md`; held draft (triager workspace)
`/workspace/agent/drafts/comment-14160-held.md`, codex OUTPUT_REVIEW approve.
- Cause, **verified by me at origin/master 6815ed82d5**: `MetalSourceEmitter::emitPostDeclarationAttributesForType`
  (slang-emit-metal.cpp:1780-1796) emits ` [[raster_order_group(0)]]` from the type alone (ROV texture access, ROV BAB/SB
  types), with no stage check. Triager saw it in compute, vertex and mesh; fragment is correct. The attribute also lands on the
  `KernelContext_0` field.
- Rec: reporter option 1 (plain `device` buffer outside fragment). It matches SPIR-V: `insertFragmentShaderInterlock`
  (slang-ir-spirv-legalize.cpp:3214) gates on `Stage::Fragment`, verified by me. Decide at the entry-point param, where
  `IREntryPointDecoration` is in scope; alternative B is an IR decoration that must survive `introduceExplicitGlobalContext`.
- Triager finding (not verified by me): DXC 1.9 rejects ROVs in compute ("RasterizerOrdered objects are only allowed in
  5.0+ pixel shaders"), so the reporter's HLSL premise is wrong; the draft says so politely.
- #13796 overlap: different files (hlsl.meta.slang vs the Metal emitter); whichever lands second tests `RasterizerOrderedBuffer<T>`.
  Bot PR #13792 also edits slang-emit-metal.cpp (rebase risk only).

**Side bug #14166 (bot-filed 11-02 10:31:31Z, owned here).** On Metal, an ROV inside a ParameterBlock gets no
`[[raster_order_group]]`, even in fragment, because the field type is `DescriptorHandle(ROV)`, which the same hook misses.
Label `reproduced`; the body does not name #14160 (verified). Filed only; no fixer without the operator.

**Fixer: none.** Precedent [14151](14151-metal-groupindex-scalar-groupthreadid.md): R6 blocks a PR until 11-06 and the
reporter often ships their own PR, so the fixer go (for #14160 and #14166) went to the operator on 11-02.

**Open.** Operator: fixer go for #14160/#14166. At release (`r6-release-14160-aa3d`, 11-06 10:08Z): if no reporter PR,
the triager posts the held draft and sets Type=Bug + `reproduced`. Owner: slang-triager, thread `gh-issue-shader-slang/slang-14160`.

**Reporter PR (supervisor tick 321).** albertrodriguezclo opened [#14171](https://github.com/shader-slang/slang/pull/14171) (`Fixes #14160`) at 11-02 10:53Z. It is non-draft and BLOCKED, waiting on a maintainer review. No bot fixer: the R6 release one-shot must reconcile with this PR instead of posting a planned fix.
