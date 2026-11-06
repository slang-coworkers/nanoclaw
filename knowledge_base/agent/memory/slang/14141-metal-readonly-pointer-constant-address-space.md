---
type: chain
title: slang#14141 — Metal read-only pointers always emit `T device*` (want `constant`)
description: Human-filed (albertrodriguezclo) perf/feature request 2026-11-01 17:44:02Z, cloth-sim batch. Triaged 11-01 feature/medium/P2, rec B (opt-in `AddressSpace.Constant`); the reporter offered the PR 11-01. HELD since 11-02 under rung 4: jkwak-work self-assigned + milestoned Q4 2026 (Fall). No bot post, no fixer; the triager draft stays held. Resume only on an @nv-slang-bot mention or an operator ask. Side bug #14142 is owned here.
tags: [metal, emit, pointers, address-space, layout, feature-request, r6]
---

# slang#14141 — Metal read-only pointer params land in `device`

**Ask.** On Metal, `uniform Args*`, `ImmutablePtr<Args>` and `Ptr<Args, Access.Read>` all emit
`Args device*` inside `EntryPointParams`; only `AddressSpace.Device` is accepted (others E30027).
Loads through them are redone after every device store (aliasing), so the reporter measures
−10% (repro) to −28..31% (real kernels) on Apple M4 when the parameter pointer and pointer table
are in `constant`. `const device` alone does not help. Workaround `ConstantBuffer<T>` changes the
binding model and the layout (`float3` 16 B vs `packed_float3` 12 B), and
`ConstantBuffer<T, CDataLayout>` is E36107 on Metal. Requests, any one of: (1) `ImmutablePtr`/
`Ptr<T,Access.Read>` → `T constant*` (or at least `const T device*`); (2) an
`AddressSpace.Uniform`-style space → `constant`; (3) `ConstantBuffer<T, CDataLayout>` on Metal.
Attachments: `repro.slang`, `layout.slang`.

**Related.** #10675 (Metal EntryPointParams wrapping, PARKED for jhelferty-nv, see
[imported/project_10675_metal_uniform_pointer_indirection.md](../imported/project_10675_metal_uniform_pointer_indirection.md));
[#14138](14138-cuda-restrict-pointer.md) (CUDA `__restrict__`, same reporter, same aliasing theme).

**Dispatch (11-01 17:46Z, Orchestrator).** Memory grep on 14141: no hits. Only session on
`gh-issue-shader-slang/slang-14141` is my own webhook session. Quick GitHub dup search: nothing
(triager to do the full one). Labels none; fenced blocks but no crash word, so the **R6 hold
applies until 2026-11-05T17:44:02Z**. Release timer: Main's `r6-release-14141-cfb7` (11-05 17:48Z);
the triager was told not to set its own.

**Progress 11-01 17:56Z (slang-triager).** Reproduced at master 6815ed82d: all three pointer forms → `device*`;
E30027, E36107 and the `float3` 16 B / `packed_float3` 12 B layout split confirmed. Not a dup; overlaps
[#13423](13423-metal-cb-scalar-layout.md) for option 3 only. That chain has bot draft PR #13425 open ("Honor
ScalarDataLayout on Metal constant buffers"), so I asked the triager whether it also lifts the CDataLayout E36107.
Side bug: ICE "Unknown addressspace" for `uniform Ptr<T, Access.Read, AddressSpace.VaryingInput>` on Metal. It may
be filed without naming #14141, and needs no operator go-ahead. Memo pending.

**Side bug filed 11-01 18:11Z as #14142** (bot, Type=Bug, `reproduced`+`Metal`+`SPIR-V`). A `Ptr` with
`AddressSpace.VaryingInput` as a uniform param or buffer field fails on Metal with E99997 "Unknown addressspace
encountered", and the SPIR-V output fails validation. Deduped vs #14005/#11981/#12487. Verified: the body does not
reference #14141 and has no @-mention. **#14142 is owned by this chain, so its issue_opened webhook needs no dispatch.**
No fixer chain.

**#13425 vs option 3:** #13425 does NOT lift E36107. CDataLayout keeps `[require(spirv/llvm/cpp/cuda)]` in
hlsl.meta.slang, which that PR does not touch. Supporting CDataLayout on Metal would be a small extension on top of it.

**#14142 issue_opened webhook (11-01, Orchestrator):** not dispatched, per the ownership note above. GitHub check: OPEN,
labels `Metal`/`reproduced`/`SPIR-V` (the webhook payload showed `[]` because the labels came after creation), 0 comments.

**[Triage] 11-01 18:27Z (slang-triager, memo `/workspace/inbox/a2a-1793557624072-98wtrx/triage-14141.md`).**
Feature (perf) / medium / P2, not a dup. I spot-checked the source at 6815ed82d: the `AddressSpace` enum has only
Device, GroupShared and VaryingInput (core.meta.slang:1446), so `.Uniform`/`.Constant` give E30027 "member not found".
`CDataLayout` is `[require(spirv/llvm/cpp/cuda)]` at hlsl.meta.slang:66-71, which explains E36107. Cause (triager):
`MetalAddressSpaceAssigner` (slang-ir-metal-legalize.cpp:172-186) keeps UserPointer, which is emitted as `device*`;
the emitter ignores the access operand. Soundness: `Access.Read` → `constant` is UNSOUND, because the doc allows writes
through other pointers. `Immutable` is sound, but a blanket switch changes all existing Metal codegen and has
constant-space size/alignment and vector-packing risks.
Options: **B (rec) opt-in `ImmutablePtr<T, AddressSpace.Constant>`** → `T constant*` with natural layout, non-breaking,
needs a surface decision. **C** = `CDataLayout` CBs on Metal, a small extension on top of #13425 (the triager has the
file list). A = blanket ImmutablePtr → constant, deferred. D = `const device`, rejected (no gain).
Decision owners: csyonghe (surface B/A), jkwak-work (C sequencing with #13423/#13425). Not an autonomous-fix
candidate now; C becomes one once #13425 merges. Draft comment is held in the triager's `memory/issues/comment-14141.md`
(codex round 3). After the R6 hold: post it, then Type=Feature + `reproduced`.

**Operator decision asked 11-01 (dashboard):** after the hold, either park everything for the maintainers
(recommended), or open C as a follow-up once #13425 merges. Timer: r6-release-14141-cfb7.

**Reporter comment 11-01 23:15Z** ([6565354376](https://github.com/shader-slang/slang/issues/14141#issuecomment-6565354376)).
albertrodriguezclo asks the **maintainers** to rule on the approach and **offers to write the PR**: front-end, Metal,
SPIR-V and CUDA parts plus tests, with the Metal side run on an M4. They prefer option 2, an opt-in
`Ptr<T, Access.Read, AddressSpace.Constant>` (name open) that is `PhysicalStorageBuffer`+`NonWritable` on SPIR-V and
`const T*`/`__ldg` on CUDA, with conversions only from `uint64_t` and by load. That is the triager's rec B.
It does not @-mention the bot, so the event is not an authorized bot post. The R6 hold still stands until 11-05 17:44Z.
⇒ **No bot fixer chain**: the reporter owns the implementation. The operator question narrows to "park for the
maintainers". I asked the triager to rewrite its held draft as a delta on the reporter's analysis (no restating),
or to drop it if a maintainer answers first.

**Draft ready 11-01 23:23Z.** The triager rewrote the held comment as a delta on the reporter's 23:15Z comment. Codex
OUTPUT_REVIEW approved it in round 2. File: its `memory/issues/comment-14141.md` (sha badc34bd…). It goes out as a fresh
comment only when `r6-release-14141-cfb7` releases it. Chain parked: R6 until 11-05 17:44Z, then csyonghe's answer to the reporter.

**#14142 triage ask from the dashboard (11-05 11:35Z):** answered in Main without dispatching. jkwak-work self-assigned
#14142 on 11-02 18:55Z with milestone `Q1 2027 (Winter)`, so it is held under rung 4. No triager or fixer, and no GitHub
comment (the body is already the triage). Verdict: front-end check (missing diagnostic) plus Metal and SPIR-V emit
symptoms, low severity. Code pointers re-checked on master 04d2726db (`slang-emit-metal.cpp:1469`).

**11-05 11:35Z: the dashboard re-sent the triage ask. State re-read live.** Since 11-01: no new comments. On
**2026-11-02 18:55Z jkwak-work self-assigned** the issue (`assigner=jkwak-work`) and set milestone **Q4 2026 (Fall)**.
⇒ It is now held under **rung 4** of
[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new](../imported/feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new.md)
(a human report with a maintainer assignee): no bot post and no fixer. It resumes only on an @nv-slang-bot mention or an
operator ask. Note: the 11-01 "R6 hold until 11-05" was the **retired** 4-day rule (see the Core Memory R6 line), so the
draft did not need to be held then. Rung 4 is what holds it now. **I cancelled `r6-release-14141-cfb7`**, because it
would have posted at 17:48Z. I told the triager to keep the draft held. I reported the verdict to the dashboard and
offered to post the delta if the operator asks.
