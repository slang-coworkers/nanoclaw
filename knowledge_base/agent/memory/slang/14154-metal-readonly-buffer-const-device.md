---
type: chain
title: slang#14154 — Metal read-only StructuredBuffer / ByteAddressBuffer emitted as writable `T device*`
description: Human-filed (albertrodriguezclo) bug 2026-11-02 10:04:27Z. Read-only buffers emit `T device*`, so a non-void vertex function gets "writable resources in non-void vertex function". Want `const device T*`. Dispatched to slang-triager under the R6 hold (to 2026-11-06 10:04:27Z). Main one-shot r6-release-14154-33ea at 11-06 10:08Z.
resource: raw/triage-14154.md
tags: [metal, emit, structured-buffer, byte-address-buffer, vertex, warning, r6]
---

# slang#14154 — Metal read-only buffers are not `const device`

**Ask.** On Metal, `StructuredBuffer<T>` and `ByteAddressBuffer` are emitted as `T device*` /
`uint32_t device*`, the same as their `RW` forms. Apple's compiler then warns
`writable resources in non-void vertex function` for each read-only buffer that a vertex shader reads.
Expected: `const device T*`. The repo test `tests/hlsl-intrinsic/system-values-draw-parameters.slang`
(its `-target metal` lane) shows the warning. Toolchain: master `6815ed82d`, Xcode 26.5, M4.

**Related.** [#14141](14141-metal-readonly-pointer-constant-address-space.md) (same reporter, Metal read-only
*pointers*). Its triage rejected option D (`const device`) because it gives no perf gain. Here `const device`
is the fix for a warning, and the subject is buffer resources, not `Ptr`. So this is a sibling, not owned by the
#14141 chain. #6427 (unused global buffers not pruned) gives the same warning for an unused `RW` buffer.

**Dispatch (11-02 10:06Z, Orchestrator).** Memory grep on 14154: no hits. The only session on
`gh-issue-shader-slang/slang-14154` is my own webhook session (sess-1793613870272-g38z4a). Quick GitHub dup
search ("writable resources in non-void vertex function", "const device metal"): only #6427. Labels none;
fenced blocks but no crash word (it is a warning), so the **R6 hold applies until 2026-11-06T10:04:27Z**: no bot
comment, label, PR or commit naming the issue before then; a fixer works locally only. Release timer: Main's
`r6-release-14154-33ea` (11-06 10:08Z); the triager was told not to set its own.

**Reporter comment 11-02 (cmt [6574811444](https://github.com/shader-slang/slang/issues/14154#issuecomment-6574811444)).**
albertrodriguezclo found the fix point: `MetalSourceEmitter::_emitType`, which spells `T device*` / `uint32_t device*`
for every `IRHLSLStructuredBufferTypeBase` / byte-address buffer. They give 3 options: (1) `const device` everywhere
(const propagates to KernelContext fields, helper params and locals; argument-buffer layout stays the same, but Metal
reflection reports `MTLBindingAccessReadOnly`); (2) entry-point params only, with a cast into KernelContext; (3) everywhere
except argument-buffer fields. They propose (1) if the reflection change is acceptable, ask the maintainers, and **offer to
prepare the PR**. The comment has no @nv-slang-bot mention, so no bot post is authorized, and the R6 hold stands.
⇒ **No bot fixer chain: the reporter owns the implementation.** I forwarded the comment to slang-triager and told it to
make its held draft a delta on the reporter's analysis.

**[Triage] 11-02 10:33Z (slang-triager, memo [raw/triage-14154.md](raw/triage-14154.md)).** Bug / low / P2 / target-emit
(Metal), not a dup (#6427 and #14141 are related only). The MSL text reproduced at 6815ed82d; the Apple warning itself was
not, since this container has no `metal`. Triager's findings, which I have not re-verified: the type text is at
slang-emit-metal.cpp:1537-1552; read-only access is already a separate IR opcode (GLSL `readonly` and
`spReflectionType_GetResourceAccess` key on it), so no type-name special case is needed. **The gap in the reporter's
option 1:** compiler-made element-pointer temps use a mutable `Ptr(T, ReadWrite, Global)`, e.g.
`tests/metal/matrix-storage-packed-layout.slang` → `… device* _S6 = mats_1+_S5;`, so making only the buffer `const`
gives an invalid const→non-const conversion. Option 1 also needs Read access on those pointers plus `const` for
Global+Read (:1438-1443). slang-rhi does not use Metal reflection for argument buffers (metal-shader-object.cpp:560-575),
which bears on the reporter's reflection question. Decision owner (triager's pick): **csyonghe**. There is no fixer handoff,
because the reporter owns the PR. Held draft v2 (a delta on the reporter's comment) has codex OUTPUT_REVIEW APPROVE (round 5).
On release it re-verifies and posts, or drops the draft if a maintainer already covered these points; then Type=Bug +
`reproduced` if still blank.
⇒ **PARKED:** R6 until 2026-11-06T10:04:27Z (release `r6-release-14154-33ea`), then csyonghe's scope ruling for the
reporter's PR.
