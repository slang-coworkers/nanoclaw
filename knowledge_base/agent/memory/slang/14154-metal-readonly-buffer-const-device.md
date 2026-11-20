---
type: chain
title: slang#14154 — Metal read-only StructuredBuffer / ByteAddressBuffer emitted as writable `T device*`
description: Human-filed (albertrodriguezclo) Metal bug 2026-11-02; read-only buffers emitted as writable `T device*`. TERMINAL 2026-11-14 01:04Z — CLOSED (completed) by the reporter's merged PR #14392 (option 1, `const` everywhere, element-pointer temps covered). jkwak-work closed it. The triager's held delta draft is moot; it was never posted.
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

**Correction 11-05 11:40Z (Orchestrator): the R6 4-day hold above is the retired rule** (nanoclaw #1993, "no waiting
period"; see Core Memory). The chain is **held for a different reason**. Maintainer **jkwak-work self-assigned** the issue
on 11-02 18:38Z (`assigner`=jkwak-work, checked on /events) and milestoned it Q4 2026 (Fall). With the reporter's
PR offer, that is owner-lookup rung 4: no bot post, no fixer; resume only on an @nv-slang-bot mention or an operator ask.
The decision owner is jkwak-work, not csyonghe (the triager's pick). The triager's held delta draft stays unposted.
`r6-release-14154-33ea` is now a **check-only re-check at 11-12 10:08Z**: no post, and it reports only if the state changes.
**11-05 11:35Z dashboard "New issue to triage" re-ask:** answered from live state; nothing was sent to the triager or
GitHub (rung 3). Live state: OPEN, 1 comment (the reporter's), no labels, no cross-referenced PR.

**Re-check 11-16 04:4xZ (`r6-release-14154-33ea`, check-only) — TERMINAL.** `gh` and the REST API returned
401 `Bad credentials` (GH_TOKEN invalid; fleet-wide outage already on the dashboard, so no new alert). I read the
public HTML pages instead (issue + PR embedded JSON, `.diff`).
- Issue **CLOSED / COMPLETED 2026-11-14 01:04:20Z**, actor jkwak-work, closer = PR
  [#14392](https://github.com/shader-slang/slang/pull/14392) "Metal: emit read-only buffers as pointers to const"
  (author **albertrodriguezclo**, opened 11-06 23:20Z, MERGED, `Fixes #14154`; dshreiner-nv and jkwak-work on the page).
  Issue comments: still only the reporter's 6574811444. No labels.
- **Ruling on the 3 options:** no issue comment from jkwak-work; the merged PR is **option 1** (`const` in
  `emitSimpleTypeImpl` for `HLSLStructuredBufferType` and `HLSLByteAddressBufferType`, user-guide table updated; the PR
  body mentions the `MTLBindingAccessReadOnly` reflection change). So the de-facto ruling is option 1.
- **Triager's gap is covered, but not the way the triager proposed.** The PR adds an emit-side walk
  `isAddressIntoReadOnlyBuffer` (FieldAddress/GetElementPtr/GetOffsetPtr → `RWStructuredBufferGetElementPtr` on an
  `HLSLStructuredBufferType`), and `emitTempModifiers` emits `const ` for such temps. It does not set Read access on the
  IR `Ptr` type. Tests: `tests/metal/readonly-buffer-const{,-entry-point,-vertex}.slang` and an edit to
  `descriptor-handle-dynamic-dispatch.slang`. Unverified by me whether helper-function params that receive such a
  pointer are covered; that is a possible follow-up, not this chain's business now that it is merged.
- No bot action is open: the triager's held draft is moot (do not release it), and there was no fixer.
⇒ **TERMINAL. No timer.** A new human comment on #14154 or #14392 is a fresh inbound.
