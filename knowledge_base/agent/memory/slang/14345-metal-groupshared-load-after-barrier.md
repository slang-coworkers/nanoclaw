---
type: chain
title: slang#14345 — Metal emits a groupshared load after the GroupMemoryBarrierWithGroupSync that follows it
description: Human (albertrodriguezclo) 11-05. TRIAGED 12:27Z bug/high/P2, dup root cause of #13409; fixed by our draft PR #13421 (and #13431). FOLDED into the #13409 chain, so no new fixer. 12:41Z the reporter opened competing fork PR #14346 (shepherd says right fix).
resource: raw/triage-14345.md
tags: [metal, groupshared, barrier, kernel-context, emit-folding, race]
---

# slang#14345 — Metal: groupshared load moved past a barrier

**Report.** `float total = sh[0]; GroupMemoryBarrierWithGroupSync(); return total;` emits on Metal as
`threadgroup_barrier(...); return (*kernelContext_0->sh_0)[int(0)];`. WGSL and CUDA keep the load
before the barrier. Reproduces at `-O0`, slangc 2026.16.1 and master 2026.20-26-ga801f2685.
Real-world hit: CG solver on Apple M4, one SIMD group read the next call's `sh[0]`.

**Intake checks (11-05).** `grep 14345 memory/` no hits; live assignees `[]`, labels `[]`, 0 comments;
no duplicate in `gh search issues` ("metal groupshared barrier", "kernelContext groupshared",
"threadgroup_barrier load moved"). Human-filed → dispatched at once (R6 no waiting period).

**Orchestrator hypothesis (REFUTED by triage: the emit fold only follows; the owner is the IR side-effect query).** The global becomes a load through the kernel-context
pointer on Metal; the emitter may fold that single-use load into the `return` across the barrier
call. Triager to confirm or refute.

## Timeline
- 11-05 ~12:10Z dispatched to slang-triager, thread `gh-issue-shader-slang/slang-14345`.
- 11-05 12:12Z triager: reproduces on master v2026.21-15-g04d2726db at -O0; prior art #13409 (entry-point path) and #13412.
- 11-05 Orchestrator found both prior-art issues are OUR open chains, assigned jhelferty-nv: #13409 → draft PR **#13421** (`fix/issue-13409`, head c42049e18, "keep groupshared memory ordered across calls on Metal/CPU"; parked on the operator CLA decision); #13412 → draft PR **#13431** (`fix/issue-13412-v2`, head 56c820f80). Asked the triager to test #14345's repro on both heads and judge dup vs. variant. **If either head fixes it, no new fixer chain: it folds into the owning chain.**
- 11-05 12:13Z triager's finding (not yet verified by me): the final IR is correct (load → barrier → return_val), and the emitter's text fold moves the load. This matches the Orchestrator hypothesis. The triager is checking why the barrier call does not block the fold. My #13421/#13431 head-test ask was already in flight.
- 11-05 12:18Z triager's root cause (not yet verified by me): in `simplifyForEmit`, `processLoadUse` sinks the load past the barrier. The Call arm of `canInstHaveSideEffectAtAddress` exempts function-local roots, and here the root is the `kernelContext->sh` pointer load. Both PRs change that arm, and #13421's HELPER test covers this shape. The triager is building both heads.
- 11-05 12:23Z triager: BOTH heads (#13421 c42049e18, #13431 56c820f80) fix the repro at -O0 and at the default level, with identical MSL. A revert drill on #13421 is running, then the triager posts. ⇒ **No new fixer chain**; #14345 folds into the #13409/#13421 chain. Plan after the final report: have the #13421 owner add `Fixes #14345`, and tell the operator that a real user hit this bug (Apple M4 CG solver), raising the priority of the pending #13421 CLA decision.
- 11-05 12:26Z triager: revert drill confirms it; #13421 without its 2-line Call-arm check reproduces the bug again. The triager is applying the label and Type, then posting the issue comment.
- 11-05 12:27Z **TRIAGED** (cmt 6657970150, verified by me: nv-slang-bot[bot], label `reproduced`, Type=Bug). Bug, high severity, P2, not a regression (2026.13.1 has the same output). Root cause: `simplifyForEmit` `processLoadUse` (slang-ir-simplify-for-emit.cpp:127) sinks the load because the `kIROp_Call` arm of `canInstHaveSideEffectAtAddress` (slang-ir-util.cpp:1648) exempts function-local roots (`load(kernelContext->sh)`). Only Metal shows it; CPU uses the kernel context but has no barrier. Memo: [raw/triage-14345.md](raw/triage-14345.md).
- 11-05 12:29:45Z routed to the #13409 owner, slang-fixer `sess-1790967825882-vnvecr` (pr-mapping for #13421; container stopped, last active 10-06). Landed as row 58 in vnvecr (verified). The send was pinned (in_reply_to=2 + target_session_id), on thread `gh-issue-shader-slang/slang-13409`. Ask: add `Fixes #14345` to the #13421 body, post one PR comment, and an optional exact-shape FileCheck case. No new fixer chain. P2, not a regression ⇒ **weekly ready-flip list, no per-PR dashboard ask**. CLA on c42049e18 is still `pending` (advisory; non_admins).

- 11-05 12:33Z fixer [Report] (msg 86) landed in the **#13409 Main session** (`sess-1790963712450-3d8ex7`), not in the #14345 session. I verified it: the #13421 body has `Fixes #13409` + `Fixes #14345`, `closingIssuesReferences`=[13409,14345], it is still a draft at `c42049e18f`, and PR comment 6658072178 is by the bot (845 chars). No new test: the `HELPER` case already pins the shape. The fixer did not re-run the repro (its build dirs are gone) and cites the triager's verification. **Dashboard 5-bullet posted from the #13409 session** on thread `gh-issue-shader-slang/slang-14345`. The #14345 Main session should NOT post it again.

- 11-05 12:41Z **the reporter opened their own fix, fork PR #14346** (`fix/metal-load-across-barrier`, head aa9a4ef676, `Fixes #14345`). It changes the same `kIROp_Call` arm with a different rule: only a local `IRVar` root is exempt, and any other root (pointer param, loaded pointer) counts as global. Test: `tests/bugs/gh-14345-groupshared-load-before-barrier.slang` (Metal + CUDA FileCheck). Shepherd jhelferty-nv (cmt 6661049450, 14:51Z): "this is the right fix". Two requests before merge: a redundancy-removal store/barrier/store test, and keeping the exemption for `out`/`inout`/`__constref` first-block params. ~15:xxZ `pr_ready_for_review` webhook: NOT forwarded (slang-pr-approver paused), queued in `data/approver-pause-queue.md`.

## Next
- **#14346 (human) and our draft #13421 now both claim `Fixes #14345`.** Whether #13421 should drop `Fixes #14345` and yield that issue to the human PR is the operator's call; it was flagged on the dashboard 11-05. #13421 still owns #13409. Don't dispatch anything to the vnvecr fixer until the operator answers.
