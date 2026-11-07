---
type: chain
title: slang#14156 — Metal emits vector<intptr_t/uintptr_t,N> as scalar long/ulong
description: Human-filed (albertrodriguezclo) bug 2026-11-02 10:04:30Z; MetalSourceEmitter::emitVectorTypeNameImpl lacks kIROp_IntPtrType/UIntPtrType. Reporter says a 2-line fix + tests/metal/intptr-vector.slang is prepared. Triaged P2 (rec. A). CLOSED on our side 11-06: reporter PR #14164 (Fixes #14156) implements fix A; no bot action.
tags: [metal, emit, intptr, r6, reporter-fix-prepared]
---

# slang#14156 — Metal intptr vectors emitted as scalars

**Ask.** `vector<uintptr_t,2>` → `ulong` instead of `ulong2` on Metal; ctors become scalar
initializers with excess elements, `.x/.y` fail in `xcrun metal`. Breaks MSL for
`tests/language-feature/types/intptr.slang` and
`tests/language-feature/generics/generic-minmax-intptr-vector-11075.slang`.

**GitHub (11-02 10:05Z).** 0 comments, no labels, no Type, unassigned. **R6:** no `bot-ok`, no crash word →
hold until **2026-11-06 10:04:30Z** (comments, PRs and commits naming #14156).
Reporter states the fix is prepared (likely a self-PR, as with #13903/#13935) → no fixer without the
reporter's or a maintainer's go-ahead.

**Dispatch (11-02 10:06Z).** slang-triager, thread `gh-issue-shader-slang/slang-14156`: triage locally,
no GitHub post before the hold ends, set a one-shot for the expiry that first checks for a reporter PR.

Triager session `sess-1793613997845-yfs716` (msg id 11) running on the canonical thread.

**Triager progress (11-02 10:07Z, msg 14; their finding, not re-run by me).** Reproduced on master 6815ed82d: MSL emits scalar `long`/`ulong`, byte-identical to the reporter. Auditing other emitters; all held locally (R6).

**Triage (slang-triager, 11-02 10:16Z, msg 16; their findings, not re-run by me).** bug/medium/target-emit
(Metal)/P2; not a dup, not a regression (case list unchanged since #4118, 2024-05). Root cause
`slang-emit-metal.cpp:1150-1167` (no IntPtr/UIntPtr case, no `default:`, count silently dropped). Extra surface:
packed path (`:1382-1389`) gives `packed_ulong` for a `vector<uintptr_t,3>` buffer field; the reporter's test misses it.
Cited tests have no Metal lane, so CI never saw it. Twin audit: HLSL/GLSL/CUDA/C++ fine; WGSL E38203; SPIR-V scalar
intptr crash = #8480/#13200 (bot PRs #13201/#13202). Options: **A** (rec.) the 2 cases; B = A + `default:` assert; C rejected.
GitHub: `reproduced` + Type=Bug set in-window, 0 comments. Memo `/workspace/inbox/a2a-1793614566466-gcqiug/triage-14156.md`
(triager copy `memory/issues/triage-14156.md`); held draft `memory/issues/comment-14156.md` (Variant N / R).
Timer: triager one-shot **`r6-release-14156-3c09`** 2026-11-06T10:10Z (reporter-PR check first, then post).

**Label ruling (me, 11-02).** Keep the labels. ⚠️ CORRECTED 11-06: the 4-day hold this chain ran under was the
RETIRED R6 rule (no waiting period since nanoclaw #1993; see Core Memory). My 11-02 dispatch copied it, the same slip as
#14159. Labels were fine either way. Original wording: R6 gates the first bot *comment*; my
10-29 extension covers PRs/commits (timeline cross-refs). Type/labels make neither, and #14035/#14057/#14135/#14136 set
them in-window. The "no label" wording in the #14138/#14141 dispatches was a sibling Main session being stricter; it is
not a rule.

**Next.** 11-06 10:10Z one-shot. Reporter PR → triager verifies it (worth asking them to cover the packed path);
otherwise post Variant N and park for a go-ahead. No fixer until then.

**Reporter PR (supervisor tick 321).** albertrodriguezclo opened [#14164](https://github.com/shader-slang/slang/pull/14164) (`Fixes #14156`) at 11-02 10:23Z. It is non-draft and BLOCKED, waiting on a maintainer review. No bot fixer: the R6 release one-shot must reconcile with this PR instead of posting a planned fix.

**CLOSED on our side (11-06 10:14Z, triager msg 20; their findings).** The one-shot fired and suppressed the comment:
reporter PR #14164 (head `e48cf40b5`, non-draft, `Fixes #14156`, mergeable, no review yet) adds exactly fix A plus
`tests/metal/intptr-vector.slang` (METAL + METALLIB lanes). The bug still reproduces on master `6d43c8d88`. Gap: no
packed struct-field test (`packed_ulong3`); by code reading it is covered, because `kIROp_MetalPackedVectorType` calls the same function.
Fork workflows are `action_required`, CLA is pending, and the `review` check failed. That is maintainer work. I decided
not to route a packed-test suggestion: the PR belongs to a person, and nobody asked the bot to review it. No fixer. The
resumable artifact is #14164, so this chain needs no timer.
