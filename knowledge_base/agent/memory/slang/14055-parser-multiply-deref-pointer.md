---
type: chain
title: slang#14055 — parser takes `a * *p` (multiply by a dereferenced pointer) as a pointer type
description: Human-filed (albertrodriguezclo, cloth-sim batch) 2026-10-29 21:51:29Z. Triaged as a regression from #6627 (v2025.6.3), frontend/parser, P1 or P2. Fix A goes to slang-fixer local-only (the #14037 R6 pattern); the triager posts and the fixer opens a draft PR after 2026-11-02 21:51:29Z.
tags: [parser, pointers, r6]
---

# slang#14055 — `3 * *p` parse failure

**Ask.** `int r0 = 3 * *p;`, `a * *p`, and `*q += 3 * *p;` fail on every target with E20001
("unexpected identifier, expected ';'") + E30060 ("expected a type, got 'int'"). The parser reads
`3 * *` as the start of a pointer type. `3 * (*p)` works. Reporter is on master 43ac12323.

**Intake (10-29).** `grep 14055 memory/slang/` found no hits, and no duplicate showed up on GitHub. No labels, 0 comments.
The R6 hold applies: the issue is human-filed with a fence but no crash word, and it has no `bot-ok`.
**No bot comment before 2026-11-02 21:51Z.**
I dispatched it to `slang-triager` on `gh-issue-shader-slang/slang-14055`.

**10-29 21:55Z (triager's report, not verified by me):** A/B/C all reproduce on local master 977df124. The triager is root-causing in `slang-parser.cpp`. The R6 hold is respected: no GitHub writes.

**10-29 21:56Z (triager's finding, not verified by me):** the root cause is `parsePostfixExpr` (`slang-parser.cpp:9622-9645`). Its `*` lookahead list includes `OpMul`, so `x * *` always becomes `Ptr<Ptr<x>>`. The triager says this came in with #6627 (Mar 2025, v2025.6.3). It is still checking for a regression against v2025.6.2 and for duplicates.

**10-29 22:09Z triage (the triager's measured figures, not re-run by me).** Regression, medium, frontend/parser, P1 under the rubric (P2 defensible: 19 months old, and parentheses work around it).
No duplicate; the sibling is #6684 / PR #6686. A, B and C fail on HEAD 977df124 on all 6 targets. v2025.6.2 compiles them (OpIMul) and v2025.6.3 fails.
The only parser commit in between is 4eb7a27ac (#6627, 2025-03-19), and blame confirms it.
**Root cause.** The `OpMul` case at `slang-parser.cpp:9637` in the type-follower lookahead of `parsePostfixExpr`. It exists because generic args go through the expression grammar
(`_parseGenericArg` → `ParseArgExpr`), so `RWStructuredBuffer<int**>` (tests/metal/pointer-in-buffer-rwbuf-alias.slang:14), `bit_cast<int**>` and `sizeof(int**)` need it.
**Fix A:** skip the run of `*`, then apply the existing follow set; only rejected programs change, so `pr: non-breaking`. B (literal-only) misses form B; C (semantic) is heavier; D (delete `OpMul`) is ruled out.
Memo: `/workspace/inbox/a2a-1793311742182-wch6ym/triage-14055.md`. Nothing posted on GitHub.

**Routing decision (Main, 10-29 22:1xZ), following the #14037 pattern.** Go for the handoff now, with fix A local-only: no push, commit or PR referencing #14055 before 2026-11-02T21:51:29Z.
The triager's one-shot posts the triage comment and labels (`reproduced`, `regression`, Type=Bug) after the lift. The fixer's push/PR one-shot runs after that.
Both stand down on a human comment (the reporter counts), an assignee, a human PR (drafts count), or a newcomer/`no-bot` label.
I added two acceptance checks: `int** pp = …;` local declarations and `(int**)` casts keep parsing as types.

**10-29 22:21Z timers (the triager's report; a peer group's tasks cannot be seen from Main).** The fixer claimed the handoff and has a worktree at 977df1246. Nothing is on the #14055 timeline.
- Triager **`t-766555`**: 2026-11-02 21:52Z. Posts the 5-bullet and adds `reproduced` + `regression` + Type=Bug. Priority is P1, so there is no P2 rationale.
- Fixer **`slang-14055-r6-push-2eff`**: 2026-11-02 22:00Z. Pushes and opens the draft PR.
- Both use the same stand-down set (after 10-29 22:09Z): a human comment (the reporter counts), an assignee, a human/draft PR, a cross-ref/`connected` link, GoodFirstBug/HelpWanted/no-bot, or a fetch error.
- The baseline scratch files decl.slang and declglobal.slang compile at HEAD. The fixer must show they still compile, with a `ParseStatement`→`ParseType` trace.
To audit a timer: `ncl sessions list --thread-id system:tasks:<series>` (a `[]` does not prove the task is absent).

**10-30 00:29Z: fix done locally (the fixer's figures via the triager; not re-run by me or the triager).** `fix/issue-14055`, 2 commits on 977df1246. Unpushed; the commit messages do not mention #14055.
Two corrections to fix A:
1. `EndOfFile` stays a type follower, because `findTypeByName("int**")` goes through `parseTermString`. A unit test was added.
2. With ≥2 `*` before `(`, the type reading stays (`int**(pp)` compiles on master). So `a * *(p + 1)` is still rejected, the same as today; the queued comment states this limit.
Tests:
- New `tests/language-feature/pointer/multiply-by-deref.slang` passes on cpu/vk/cuda and fails on master.
- The decl and declglobal baselines are unchanged.
- Full suite 11304/11307; the 3 failures are `fp8-cuda*`, the same pre-existing class as #14037.
- Codex approved both the plan and the code.

**Side finds (pre-existing, unfiled at 00:29Z).**
- `__getAddress(rwsb[0])` stored into `RWStructuredBuffer<int*>` gives invalid SPIR-V (OpStore type mismatch).
- Scratch declglobal.slang **hangs** on `-target wgsl`.
- Scratch decl.slang gives E99999 on hlsl/glsl; possibly the #13632 class.

Main's decision (10-30), following the #13435 precedent: the triager dedups each one and files only the non-duplicates as bot issues, with **no #14055 reference before the R6 lift** (a cross-ref is a timeline event). Their `issue_opened` webhooks are bot-filed and owned by the triager from this chain, so they need no dispatch.

**10-30 00:41Z side-find outcomes (the triager re-tested on master 1f0b33b86).**
- **GLSL E99999 → filed as #14078** (bot, 00:40:19Z). The trigger is a ptr→ptr cast `(float*)intPtr`, not declarations. Fix A = `lowerBitCast` → `PtrCast` for targets other than direct SPIR-V.
  Labels GLSL + reproduced; triage comment 6512026888. Handed to slang-fixer on `gh-issue-shader-slang/slang-14078`.
  **The `issue_opened` webhook for #14078 needs no dispatch.** I verified on GitHub: the body says "Found while testing a parser change" and does not mention #14055.
  The webhook reached Main's `sess-1793320821887-9480o1` (10-30); not dispatched. Owner: slang-fixer `sess-1793320862886-o2rgdf` (created 00:41:02Z).
- **HLSL E99999 → duplicate of #13632.** Draft PR #13856 (E55219) is still unmerged, as is #13652.
- **SPIR-V `__getAddress` OpStore → duplicate of #13418** (bot, assigned jhelferty-nv, awaiting_human). There are 3 more shapes: a `RWStructuredBuffer<int*>` element, a local `int* p` then `buf[0] = p`, and `*out = …` through `uniform int**`.
  Main said yes (10-30) to ONE concise comment on #13418 with those shapes, with no #14055 reference (relay below).
- **WGSL hang → not reproduced** (exits 0 in under 1 s; only the #13399 invalid `ptr<,…>`). Waiting on the fixer's exact command, binary and env before anything is filed. **00:43Z: REPRODUCED** with the fixer's shape (a non-entry function returning a pointer; 30 s timeout on master 1f0b33b86; v2025.6.2 finishes in 1 s, so it is a REGRESSION). The triager is bisecting, then files it under the same rules (no #14055 ref).
  **00:52Z: DUPLICATE of #12498**, so nothing is filed. Trigger: any non-entry function returning a pointer, e.g. `int* helper(int* x){return x;}`. v2025.18.2 OK; v2025.19+ hangs. Exposed on WGSL by #8668 (e420f2f98, `specializeAddressSpaceForWGSL`).
  Root cause (the triager read it in the source): `newWorkList` at slang-ir-specialize-address-space.cpp:700 is never cleared. Bot PR #12563 already fixes it as change (1). That PR has CHANGES_REQUESTED from jvepsalainen-nv (the assignee); round-2 reply 10-18; it is stalled and conflicts with master (and with merged #13648's origin-keyed cache, per the #13643 record).
  **Main 10-30:** (a) YES, the triager posts the WGSL shape + release bracketing on #12498. (b) NO bot split-PR. #12563 is under active maintainer review, so the comment *offers* landing the one-line reset separately and the humans decide.
  **00:56Z: posted on #12498 (comment 6512223455).** The fix for the hang on its own is already **open PR #13151 by jvepsalainen-nv** ("Reset address-space fixpoint worklist each round", review requested from dshreiner-nv, idle since 10-09). So the comment points there, and no split was offered. The trigger is narrower: a helper that *returns one of its pointer params* (`return x;`, `c ? a : b`); `return x + i;` finishes.
- **#14078 fixer:** the session is `sess-1793320862886-o2rgdf` (the only one). Its 00:42Z claim ack went to MY session, not the triager's, so I told the triager not to re-dispatch.
  **01:46Z: draft PR #14080** (`fix/issue-14078`, head 96d85ba9e, `Fixes #14078`, `pr: non-breaking`). The fixer chose **approach B**, GLSL `kIROp_BitCast` emit, because `bitCast(uint64/uint2 ↔ T*)` is a valid IR shape with several producers (`bit_cast<float*>(uint64_t)`, pointer struct fields, existentials). The triager accepted it.
  I verified via gh that neither the PR body nor its comments mention #14055 or the reporter's context. Issue status comment 6512901925. Next: peer review → maintainer review.
  **02:27Z: R1 peer review of #14080 (the slang-reviewer's findings, reported to me; memo `/workspace/inbox/a2a-1793327240072-g2bbtr/combined-review.md`).**
  Head 96d85ba9e: **APPROVE_WITH_NITS**, 0 bugs, 2 gaps.
  - G1: the 2 `-entry packedMain` Vulkan rows are vacuous, because render-test ignores `-entry` and runs computeMain.
  - G2: an undisclosed second fix (the pack-only uvec2 extension) is not pinned by a test.
  Suite 11098/11101 (3 known fp8-cuda). The verdict and a test-only remedy patch went to the fixer. No further round, and nothing posted on GitHub.
  Next: the fixer applies them, sends the [Fix Report] to the triager, and the #14082 handoff unblocks.
  **02:58Z: [Triage Resolution] #14078.** Draft #14080 is at head **e0542eb81** (I verified it: still a draft; CI 6 SUCCESS + 53 SKIPPED, the draft gating; no #14055 in the body). The nits are applied (existential rows in their own `computeMain` file, a uvec2 test, the helper contract asserted) with no further round.
  The fixer reports 2 new tests at 10/10 on the L40S, related suites 3405/3405, and bit-cast files 71/71. **PARKED on the operator's ready flip, then maintainer review.** I named that on the dashboard 10-30; the supervise register walks it.
  #14082 is handed to the fixer (claimed 02:59Z, `wt-slang-14082` on `fix/issue-14082` stacked on `fix/issue-14078` @ e0542eb81), **stacked on #14080** (item 2 is inside the new `_emitBufferReferenceConversion` helper). The reviewer's 5th side find, `bit_cast<uint64_t>(double)` on GLSL, comes from `doubleBitsToUint64` never requesting the int64 extension; the triager is filing it on its own.
  **01:54Z: the fixer's status came to ME (msg 48), not the triager.** #14080 is with slang-reviewer and CI is queued. It also listed 4 more pre-existing GLSL pointer-emit side finds that the E99999 was hiding:
  1. A store through a pointer is emitted as `q + 1 = 3;` (no `._data`).
  2. A null pointer is emitted as `0`.
  3. `Ptr<int>(42)` becomes `BufferPointer(42L)`.
  4. A `void*` block declares `void _data;`.
  I forwarded them to the triager (pinned `1k60r3`, `in_reply_to=2`). The fixer keeps the repros in its group at `/workspace/agent/scratch-14078/` (not `/tmp`). Direction: dedup first, default to ONE issue with a checklist, keep them out of #14080's scope, and no #14055 reference.
  ⚠️ Delivery check: `ncl sessions messages` on a RUNNING session shows only `out` rows, so I could not see the inbound. The evidence is indirect: `1k60r3` went from idle since 01:46 to `last_active` 01:55, and no new triager session was minted. **Confirmed at 01:56Z:** the triager acked. All 4 reproduce on 1f0b33b86 and back to v2025.6.2, so none is a regression. Next for the triager: root-cause, dedup, then one checklist issue.
  **01:59Z outcome:** item 1 (store without `._data`) duplicates **#13393** (and the older #8630); its fix is draft bot PR #13410.
  Items 2–4 were filed as **#14082** (bot, GLSL + reproduced, Type=Bug, P3, triage comment 6513082988):
  - null written as `0`: the `kIROp_PtrLit` case at emit-glsl:2894;
  - the signed operand in the CastIntToPtr/PtrCast constructor (:2904);
  - `void _data`: `emitBufferPointerTypeDefinition` (:2185).
  I verified on GitHub that it has no #14055 reference. **The `issue_opened` webhook for #14082 needs no dispatch** (bot-filed, owned by the triager here).
  The fixer handoff is HELD until the #14080 [Fix Report] arrives (they touch the same emit-glsl cases). Main accepted that, and the hold is stated publicly in the triage comment.
  **10-30: the #14082 `issue_opened` webhook reached Main; not dispatched** (grep hit this record first; body cites only #14078/#14080, no #14055).
- **#13418 relay:** the owner session is `sess-1793273625935-bb46pw` (triager). I pinned it with `in_reply_to=2` (my webhook row) at 00:53Z and verified it landed (its seq 6). It posts one fresh comment and reports the id.

**Next.** The 11-02 timers. Then the triager sends the [Triage Resolution] when the PR opens.
