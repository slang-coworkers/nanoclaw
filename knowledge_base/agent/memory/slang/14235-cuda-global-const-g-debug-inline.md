---
type: chain
title: slang#14235 — CUDA global constant from a pure `[ForceInline]` helper keeps a call under `-g` (G2 regression from #14150)
description: Human-filed (jvepsalainen-nv, NVIDIA) 2026-11-03 07:15Z, self-assigned, own fix PR #14236. It is the G2 regression our #14150 comment 6592707618 flagged. Owned by the reporter; follow-up runs in the #14133 triager session. No fixer chain.
tags: [cuda, debug-info, force-inline, static-const, regression, reporter-pr]
---

# slang#14235: `-g` stops global-scope inlining of a pure helper (from #14150)

**Ask.** `static const bool enabled = isSet(flags, Flags.udim);` uses a `[ForceInline]` enum helper. Under `-g`,
CUDA emits `__device__ static const bool flip_0 = isSet_0(3U, 2U);`, and NVRTC fails with "dynamic
initialization is not supported". Without `-g` it folds to `2U`. Seen in the Falcor2 ToT nightly (Win/Linux).
The reporter's diagnosis is that `isInlinableAtGlobalScope` → `mightHaveSideEffects()` rejects debug insts.

**Lineage.** This is **G2** from the [#14133 chain](14133-cuda-static-const-forceinline-init-file-scope.md).
#14150 (Fix A) **merged 11-03 02:06:54Z** at `d79256b0f` (merge `76a45e10c1`), 56 min after our regression
comment 6592707618, with no changes. G1 (int `/`/`%` with a non-literal divisor) is on master too and is not filed.

**Reporter PR #14236** (ready, head `4c34875dbb`, branch `codex/fix-global-inline-debug-info`, "Fixes
#14235"). It adds `|| isDebugInfoInst(inst)` to the skip in `isInlinableAtGlobalScope` (+2/−1) and a CUDA test
with and without `-g`. That covers G2 only.

**Routing (11-03 07:18Z).** `grep 14235` found nothing, and the `isInlinableAtGlobalScope` grep hit the #14133
records. Precedent #14153: defer to the reporter's PR. No new triager session; the follow-up went to the #14133
triager (`sess-1793514365085-a6bfnv`, pinned send with `in_reply_to=2`, thread `gh-issue-shader-slang/slang-14133`,
msg id 15). It acked at 07:20:07Z. Asks: no bot post on #14235/#14236 except an in-scope correctness gap (comes
to me first); verify G1/G2 on master `76a45e10c1` and on #14236; check #14217; **file G1 now if it still
fails** (no operator go-ahead needed); fixer keeps `fix/issue-14133` local; re-aim `t-700e05` from #14150 to
#14236 / #14217 / #14235; send `[Triage Resolution]` to me.

**Next.** On the triager's resolution: if a G1 issue is filed, ask the operator about a fixer chain (it is a
regression fix, so it may skip the weekly ready-flip list). Its `issue_opened` needs no dispatch. On #14236
merge, close out (fixer drops its branch unless G1 uses it).

**11-03 07:28Z.** G1 was filed as **#14238**, and the operator was asked about a fixer chain (07:30Z). See the
[#14133 record](14133-cuda-static-const-forceinline-init-file-scope.md). The triager found no gap in #14236, so nothing is to be posted on #14235/#14236.

**11-03 approver event.** #14236 `ready_for_review` (synchronize) at head `0c44c95545` (2nd commit only moves the test to `tests/language-feature/function-calls/`); CI 60/60 pass, no reviews. Not forwarded (slang-pr-approver paused); queued in `data/approver-pause-queue.md`. Later events for #14236 need only the `paused` check.

**11-03 17:37Z.** jkwak-work opened **#14243** (fork, stacked on #14236): one commit `eaa89369` that splits the terminator / `isDebugInfoInst` skip into two conditions, per #14236 review cmt r4457875419. Its `ready_for_review` fired 17:37:38Z, then it went back to draft 43 s later. Not forwarded (approver paused); queued in `data/approver-pause-queue.md`. A maintainer's own readability follow-up; it needs no fixer or triager.
