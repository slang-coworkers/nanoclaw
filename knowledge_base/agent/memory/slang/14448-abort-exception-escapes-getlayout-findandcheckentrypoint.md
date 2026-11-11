---
type: chain
title: slang#14448 — AbortCompilationException escapes getLayout / findAndCheckEntryPoint (SLANG_NO_THROW) on E39997 type-nesting overflow
description: Human (g-whiz, Rust-bindings author) 11-10 22:57Z, no labels/assignees. TRIAGED 23:14Z bug/medium/P2, reproduced on master 56ff2a8338; 3 methods leak (incl. getTargetHostCallable found by census). Fixer dispatched by the triager; **draft PR #14450** (head 9399064c0) review-complete (r1 APPROVE_WITH_NITS, nits applied); RESTING on maintainer review (kaizhangNV assigned + requested); on the weekly ready-flip list. Sibling of #12387 / PR #12552.
resource: raw/triage-14448.md
tags: [public-api, exceptions, slang-no-throw, layout, entry-point, dispatched]
---

# slang#14448 — exceptions escape `SLANG_NO_THROW` getLayout / findAndCheckEntryPoint

**11-10 22:57Z `issue_opened`.** Author g-whiz (human), 0 labels, 0 assignees (events API empty at 22:58Z). Memory grep:
no prior chain (only coincidental substrings in July board dumps). Dupe search: precedent #12387 (closed, PR #12552), #8376 / #13351 related, not dupes.

**22:59Z** dispatched slang-triager (`sess-1794351577414-d905d6`, thread `gh-issue-shader-slang/slang-14448`, msg 7).

**23:14Z [Triage]** (triager's findings; GitHub side verified by me 23:15Z: comment 6781902698 by nv-slang-bot, label
`reproduced`, type Bug):
- Reproduced at origin/master `56ff2a8338`: all 3 repro cases throw out of the API; `-DNO_CATCH` → rc 134. Controls match (N=126 OK, N=128 load fails E39997).
- Census found a 4th leaking surface: `IComponentType2::getTargetHostCallable`. 31 `SLANG_NO_THROW` methods: 10 guarded, 15 trivial, 6 unguarded-throwable;
  3 with a demonstrated trigger (getLayout, findAndCheckEntryPoint, getTargetHostCallable). specialize / serialize / writeToFile left as follow-ups (no failing test).
- Not a regression (39997 cap from #10533, 2026-03). #12552 added no helper; the current idiom is `link()`'s `SLANG_EXCEPTION_TRY` / `#if SLANG_HAS_EXCEPTIONS` form (from PR #13244), slang-linkable.cpp:548-574.
- Rec **A**: per-method three-arm guard at slang-linkable.cpp:119, :642 and slang-module.cpp:116 + no-GPU unit tests. C (make 39997 non-fatal) and D (guard in getOrCreateLayout) rejected.
- Triager handed off to slang-fixer directly (fixer session `sess-1794352365408-u0gpy6`, ag-…-vmjrwe). Triager waits for the [Fix Report], then posts the [Triage Resolution].

**11-11 00:13Z triager [Report]** (verified by me 00:14Z): **draft PR #14450** `fix/issue-14448` head `e70c7393c`, `pr: non-breaking`,
`Fixes #14448`, author nv-slang-bot; pr-mapping → fixer `sess-1794352365408-u0gpy6` (vmjrwe), thread gh-issue-shader-slang/slang-14448.
Fixer's claim: 3 new unit tests fail on master and pass with the fix; unit suite 687/687. Fixer 5-bullet on the issue: cmt 6782932148.
- Incident (self-corrected): at 00:12:10Z the triager's edit-in-place PATCHed the fixer's comment 6782932148 (shared bot login);
  it restored the original from edit history at 00:12:43Z. I checked the current body: it is the fixer's text. Triager saved the lesson (PATCH only own id-file comment).

**11-11 01:12Z [Triage Resolution]** (verified by me 01:13Z): PR #14450 draft, head `9399064c0`, MERGEABLE, 4 files +263/−22,
assignee + review request **kaizhangNV**; checks 3–4 pass / 56 skipped (draft CI, run 42936290443). Delta comment 6783997167 on the issue.
- slang-reviewer r1 APPROVE_WITH_NITS (0 bugs / 1 gap: entry-point recovery check bypassed via `findEntryPointByName` early return); nits applied in 9399064.
  Open design Qs for the maintainer: C001 boundary in `getOrCreateWholeProgramResult`?, C003 shared helper for the 3-arm block?, C004 duplicate E39997 in blob (pre-existing in `link`).
- Tests (fixer/triager claims): 3 new unit tests 0/3 master → 3/3; per-guard revert drill isolates each; reporter repro `-DNO_CATCH` rc 134 → 0.
  Unit suite 686/687 at 9399064: `ValidateWithDownstreamCompiler` (from #14419) corrupts test-server RPC, passes 3/3 alone; reviewer measured 687/687. Full tests/: only 3 fp8-cuda fails, also on master.
- Follow-ups kept OUT of this PR: specialize, serialize/writeToFile, `ISession::getTypeLayout`, `...` arms on one-arm guards. Not filed yet.

**Next:** maintainer review of #14450 (webhooks deliver it to the fixer session) → ready-flip on the weekly list (P2, not a regression; no per-PR ask). No timer. (`Fixes #14448`) → slang-reviewer → ready-flip goes on the weekly list (P2, not a regression).
