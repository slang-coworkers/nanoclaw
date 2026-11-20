---
type: chain
title: slang#14569 — LLVM CPU: E41403 on RWStructuredBuffer<Atomic<T>> element atomics
description: HUMAN-filed 2026-11-18 by albertrodriguezclo. Triaged + fixed same night (draft PR #14575, head 9799acfab, review complete) — then PARKED 11-18 19:02Z on maintainer direction: land ExprInfo PR #14470 first. Side-finds #14578/#14579 filed-only pending operator.
tags: [cpu, llvm, atomics, structured-buffer, human-filed, maintainer-held]
---

# slang#14569 — LLVM CPU E41403 on SB<Atomic<T>> element atomics

**Issue.** https://github.com/shader-slang/slang/issues/14569 — on `-emit-cpu-via-llvm`, an atomic on an
element of `RWStructuredBuffer<Atomic<T>>` is falsely rejected with E41403 "neither groupshared nor from a
device buffer". Same kernel passes on `-target cpp` / host-callable default. Human author is the #14036/#14567
reporter (albertrodriguezclo). Related: #14191 (LLVM atomics E99997 — maintainer-owned, see
[side-bugs record](14190-14192-cpu-atomic-side-bugs.md)) and #14192. Author reports 5 of 30 atomic-failing
kernels in a 230-kernel production sweep hit this.

**Chain.** issue_opened webhook → dispatch to slang-triager 11-18 00:24Z (my session d4rk6q, canonical thread
`gh-issue-shader-slang/slang-14569`, 👀 reaction posted). Triager session `a8rfv5`; triaged 00:39–00:40Z:
bug / medium / P2, duplicate: no; `reproduced` label + Issue Type Bug applied. Handed straight to slang-fixer
(direct triager→fixer handoff): fixer session `sess-1794962423937-99urct`, same canonical thread, 00:40Z.

**Triage diagnosis (triager's report, unverified by me):** for CPU-via-LLVM, `lowerCPUResourceTypes` runs
BEFORE `validateAtomicOperations` (slang-emit.cpp:2404-2421) and rewrites `RWStructuredBufferGetElementPtr`
into `GetOffsetPtr` over a buffer field typed `AddressSpace::Generic` (slang-ir-lower-cpu-resource-types.cpp:93);
`isValidAtomicDest` (slang-ir-validate.cpp:535-615) accepts neither. Recommended fix (approach A, producer-side):
emit `AddressSpace::UserPointer` instead of `Generic` at the three sites (lower-cpu-resource-types.cpp:76,93,112)
— matches the pass's own `T* data` lowering; LLVM emitter flattens address spaces (slang-emit-llvm.cpp:289-305).
Approach B (teach the validator the lowered shape) rejected as consumer-side patching. Post-fix the repro is
expected to proceed to the known #14191 E99997 emitter gap — that is the intended terminal state of this chain,
not a failure.

**Guardrails.**
- #14191/#14192/#14190/#14193 are maintainer-owned (jkwak-work, milestone Q1 2027, filed-only) — do not start
  separate fixer chains for them from here; this chain is only about the E41403 false rejection.
- Don't touch `slang-emit-llvm.cpp` atomic emission (TODO atomics) — that's #14191's scope.

**Side-finds from the #14575 round-3 review (triager-filed 11-18 05:34Z, both `reproduced` + Type Bug, 0 comments):**
- **#14578** — LLVM CPU: atomics in `static` initializers silently dropped (no ctor, no diag, exit 0; initializer
  lowers correctly, vanishes at whole-program link/merge; silent path is specifically unreferenced statics).
- **#14579** — LLVM CPU: 0-param compute kernels get verifier-invalid dispatcher call sites; generic to any empty
  `main()`, independent of atomics; LLVM verifier errors don't fail the compile.
Both **FILED-ONLY — fixer chains gate on the operator** (asked dashboard msg 65, 11-18 ~05:40Z; triager one-shot
re-check t-9e76ed 09:30 UTC covers the pending decision).

**Maintainer hold (11-18 19:02Z — supersedes the ready-flip).** jhelferty-nv on the issue (cmt 6988569380):
"I think we probably want to land the `ExprInfo` change first before fixing this. (#14470) Tess believes that change
may make this fall under the umbrella of a more systematic check." #14470 = jhelferty-nv's open PR "Split QualType
into an ExprInfo with a value category and an access" (fixes #13831/#13394). Disposition: **PR #14575 PARKED pending
#14470** — ready-flip CANCELLED (off the weekly undraft list), no pushes/review requests; park, don't close ("land
#14470 first" = fix comes after). Triager relays: ack the direction on the issue in place + hold [Triage Resolution]
(relayed msg 73, authorized); fixer hold notice (msg 75). Ack VERIFIED live on the issue 19:05Z (cmt 6988649217,
bot, fresh delta comment — in-place edit would have buried it below the maintainer's; [Triage Resolution] held).
One-shot re-check **i14569-recheck-exprinfo-d889**
(2026-11-25 10:00Z): on #14470 merge → wake chain to re-evaluate supersede/rework/proceed; on new maintainer
comment → webhook already routed, end clean; else report + re-arm +7d. Operator named (dashboard msg 79).
Resume rule: on ANY maintainer comment on #14569/#14575 (webhook) or #14470 landing (re-check) — never self-schedule
a recurrence for the single issue. Fixer hold confirmed (worktree `/workspace/agent/wt-slang-14569` + sentinel stay
in place, paused not closed; on resume, FIRST re-read the issue thread for newer direction, then decide supersede/
rework/proceed against the parked diff at `9799acfab`).

**Next.** **TERMINAL on our side 11-18 ~05:40Z** — [Fix Report] received and Main-verified (PR #14575 live:
draft, head `9799acfab`, 15 commits (comment-only post-report delta), `pr: non-breaking`, mergeable_state `behind` — master advanced, no overlap
with touched files; merge-master on maintainer preference only, never rebase). Fix = UserPointer at 3 lowering
sites + unconditional E55219 `checkUnsupportedLLVMCPUAtomics` gate at end of linkAndOptimizeIR (fixes the ICE
for pointer + groupshared forms too) + 5-variant regression test. Review: r1 RC (ICE-enshrining test) → r2 RC
(min-opt ICE regression, fixed by hoisting the gate) → r3 APPROVE_WITH_NITS, nits applied, no further round.
Reviewer A's exit-code dispute conceded (slang-test in-process tool flattens failed compiles to -1,
tools/slang-test/slangc-tool.cpp:68; only spawned slangc gives -2). Tests: tests/llvm 22/22, cpu-program 11/11,
SPIR-V/HLSL unchanged. ~~Ready-flip on the weekly undraft list~~ **→ CANCELLED by the 11-18 maintainer hold (above);
awaiting #14470 + re-evaluation, resume per the hold block only.** #14191's implementer removes the gate and upgrades the test (per its header).
Triage outcome comment: https://github.com/shader-slang/slang/issues/14569#issuecomment-6965377780.
Raw triage memo preserved: [raw/triage-14569.md](raw/triage-14569.md).
