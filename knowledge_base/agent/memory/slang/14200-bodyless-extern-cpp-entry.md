---
type: chain
title: slang#14200 — body-less `__extern_cpp` entry point crashes slangc or is silently dropped (side find from #14197 R1)
description: Filed by the triager 11-02 20:42Z after a repro on master 48802eb48 (P3, linker). slang-fixer owns approach A in sess-1793652245896-1j98hs on gh-issue-shader-slang/slang-14200.
tags: [linker, crash, extern-cpp, side-find, 14033]
---

# Body-less `__extern_cpp` entry point → ICE / silent drop

**Repro.** `[shader("compute")][numthreads(1,1,1)] __extern_cpp void NoBody(uniform float* p, uint3 tid : SV_DispatchThreadID);`
Release builds segfault on cuda/cuh/cpp/hpp/spirv. hlsl/glsl/metal/wgsl return rc 0 with the entry
point dropped. Without `__extern_cpp`, every target gives E45001. Triager memo:
`/workspace/inbox/a2a-1793651913396-kqxpkk/triage-bodyless-extern-cpp-entry.md`.

**Cause (triager, source-checked).** `isFunctionDefinedOrImported` (`slang-ir-link.cpp` ~1856) treats
ExternC/ExternCpp/UserExtern as "defined" (added for CPU library binding in #9492), so E45001 is
skipped for entry points as well. The legalizer then null-derefs (`slang-ir-legalize-varying-params.cpp`
:2440 CUDA, :2720 CPU). Main checked that the case list is unchanged on master 48802eb48.

**Related, not a duplicate.** #12515 (open, assigned jvepsalainen-nv) and PR #12542 (open, our bot,
`[CudaKernel]` at a different site, no activity since 09-17). Option C (fold into #12542) was rejected
because it couples chains and the site is different.

**Main decision (11-02 ~20:45Z).** The triager's repro was on 3649fb982 (07-17, 603 commits behind
master), so it must reproduce on current master before filing; filing then needs no operator OK
([policy](../orchestrator/filing-verified-issues-policy.md)). Approach A (exempt-skip for
`IREntryPointDecoration` funcs; body-less `__extern_cpp` helpers must still compile) goes to
slang-fixer as its own chain on the new issue's canonical thread, not in #14197.

**11-02 20:42Z — filed as #14200** (author nv-slang-bot, Type=Bug, `reproduced`). The triager
re-reproduced on master 48802eb48 with the same results. The "3649fb982" label was a stale
configure-time version string; that build was from 11-01. Main verified: no @-mentions, no `Fixes`,
one triage comment (6587987952). Exactly one fixer session (`sess-1793652245896-1j98hs`) on
`gh-issue-shader-slang/slang-14200`. `sess-1793652176304-cversx` on that thread is a **Main**
session (group ag-1776713211742-1w6l4e), the one that took the `issue_opened` webhook, not a
triager session. The triager handed off from its own session via a2a. The new-chain
report went to `orchestrator-dashboard` at 20:4xZ (owed item closed). Next: the fixer's draft PR +
[Fix Report], then the triager's [Triage Resolution].
**20:45Z.** The fixer claimed the issue: worktree `wt-slang-14200` on `fix/issue-14200` at 48802eb48.
Debug build next, then the repro test, then approach A. The `issue_opened` webhook needed no
dispatch from Main.
**21:21Z — fixer update (fixer's claims; Main has not verified).** Approach A as briefed gives E45001 on
all 9 slangc targets, and the suite result is 11393/11396 (only the known fp8-cuda env failures).
/code-review then found two gaps. (1) In the API path (`findAndCheckEntryPoint` on a non-`[shader]`
func), the source func has no `IREntryPointDecoration`, so it still crashes. (2) `[DllImport]`
entry points bypass the check. Rework: `specializeIRForEntryPoint` tells the link check explicitly
that the func is an entry point (same E45001, ~10 lines). A body-less plain `extern` entry point
hits the existing #12728 assert (open, kaizhangNV), which is out of scope. Main replied: go ahead.
The PR body must state where it differs from the posted triage verdict, and it must have tests for
both gaps.

**11-02 22:03Z — draft PR #14202** ("Report E45001 for body-less entry points bound to external
definitions", `fix/issue-14200`, head `0ebe54550`, `Fixes #14200`). Main verified that the
`pr-mappings` row points to fixer `sess-1793652245896-1j98hs`. Only `slang-ir-link.cpp` changed,
plus 3 diagnostic tests and 1 unit test. The triager says the PR goes further than approach A:
it also covers `[DllImport]` entry points and entry points without `[shader]` (chosen by
`findAndCheckEntryPoint`, so they have no `IREntryPointDecoration` before link), which is why
`specializeIRForEntryPoint` (~:1249) also changed. The reviewer should check that wider scope.
Not covered: a plain `extern` body-less entry point still asserts on `IRPtrLit` at link time. The
triager says #12728 tracks that, but #12728's title, "Structural stage composition asserts while
cloning a high-level declaration pointer", only plausibly matches; Main has not verified it.
Next: peer review, then the [Fix Report], then the [Triage Resolution].
**22:22Z — draft PR #14202** "Report E45001 for body-less entry points bound to external definitions",
`fix/issue-14200`, head `0ebe54550`, `pr: non-breaking`, `Fixes #14200`. Main verified on GitHub:
5 files (`slang-ir-link.cpp` +57/−31, diagnostic tests for dllimport, extern-cpp entry, and extern-cpp
helper, plus a unit test), no @-mentions, no external links. The pr-mapping points to the fixer
session `sess-1793652245896-1j98hs`. CI showed 4 pass and 53 skipped (draft). Final design (fixer's
account): approach A widened to every extern exemption, plus a `specializeIRForEntryPoint` check.
Both evaluate one predicate on the same `bestVal`. A specialize-only check segfaulted `-target cpp`,
because each entry point is linked separately there. Fixer's figure: full suite 11406/11409. Two
fixer measurements: the slangc `-entry` rows pass under plain A (slangc decorates `-entry`
functions during lowering), so the gap's fail-under-A test is the CUDA API unit test; the
`[DllImport]` test fails under A. Dashboard report sent at 22:2xZ. Next: slang-reviewer verdict,
then [Fix Report].
**23:53Z — #14202 R1 = REQUEST_CHANGES (small)**, fixer's account. The reviewer's remedies (generic
double report, API-path test coverage) and 7 nits were applied as 3 forward commits. Full suite
running; R2 next. **Side find G2:** a generic body-less `__extern_cpp` entry point
(`-entry 'GNoBody<A>'`) gives E45001 and then E99997 "expected entry point to be a function", because
`specializeGeneric` returns a non-`IRFunc` (`slang-ir-link.cpp:1237`, `SLANG_UNEXPECTED`; cause
untraced). Seen on master 9b46bca64 and on the PR head. Deduped by the reviewer, and Main searched the
open issues too: none found. **Main decision:** not folded into #14202. The fixer files it as a
filed-only issue (no fixer chain) and names its number in the Risk line. Main also checked #12728: it is
the same `slang-ir-link.cpp:398` `IRPtrLit` assert but a different trigger (structural RT stage
synthesis), so the fixer is told to change "tracked in #12728" to "same assert as #12728 (different
trigger)". **Owed:** the new issue number → dashboard.
**11-03 00:00Z — G2 filed as #14213** ("Body-less generic `__extern_cpp` entry point aborts with E99997
after reporting E45001", author nv-slang-bot, label `reproduced`). It is a filed-only issue: no fixer chain
and no triager dispatch. The `issue_opened` webhook reached a new Main session
(`sess-1793664053505-0i98jv`), which did not dispatch. Main checked GitHub: no comments, no @-mentions,
no external links, but Type was null (#14200 and #14211 have Type=Bug). The fixer was asked (seq 26 in
`1j98hs`) to set Type=Bug and, with the R1 push, to update the Risk line. At 00:03Z the #14202 head was
still `0ebe54550` and the Risk line still said "tracked in #12728". Number sent to the dashboard (owed item closed).
**11-03 00:00Z — G2 filed as #14213** ("Body-less generic `__extern_cpp` entry point aborts with E99997
after reporting E45001"). Bot-filed by slang-fixer; `reproduced`, Type=Bug, no assignee. Main
verified on GitHub: no @-mentions, no `Fixes`, no external links. Repro on master 48802eb48 and
9b46bca64, cause marked untraced. **#14213 is filed-only: an `issue_opened` webhook for it needs
NO dispatch (no triager, no fixer chain).** The fixer has edited #14202's Risk line to name #14213
and to say "same `IRPtrLit` link assert as #12728 (different trigger)". It goes up with the R1 commits
after the full suite; at 00:11Z the PR head was still `0ebe54550`. The number has been reported to
the dashboard. Next: R1 push → R2 verdict → [Fix Report].
(Dashboard: #14213 was reported twice. The sibling's row is seq 510302 at 00:04Z, and Main's row is
seq 510306 at 00:11Z, which adds the Risk-line detail. Nothing more is owed.)
**11-03 01:11Z — #14202 R1 pushed, R2 requested.** Main verified the head is `9968e2f20` (draft, 6
commits). The Risk line names #14213 and says "same `IRPtrLit` link assert as #12728 (different
trigger)". CI at verification: 4 pass, 53 skipped (draft). Fixer's figures, not verified by Main:
B1 (generic entry point reported twice) and G1 (API test now on all 4 targets) are fixed, and the 7
nits are applied. Every new test passes (27 diagnostic rows, 4 unit tests, the #9492 control).
`tests/diagnostics/` 1044/1044. Full suite 11442/11446: 3 known fp8-cuda env failures, plus a
CUDA "Unable to create renderer" failure that passed 9/9 in three standalone reruns. The issue
status comment was edited in place. Main sent no dashboard report for this intermediate push.
Next: the R2 verdict (the last round), then the [Fix Report] → dashboard.
**11-03 02:55Z — [Fix Report].** #14202 head `32859719b`, draft, 7 files (+368/−35), adding generic and
intrinsic diagnostic tests. Peer review: R2 = APPROVE_WITH_NITS, and the fixer applied the reviewer's
patch. Fixer's figures: 24 new rows fail on master and pass at head; full suite 11445/11448 (fp8-cuda
×3). Main verified the head, the file count, that the body has no @-mentions, and the explanation
comment 6589788838 (updated 02:55Z). CI run 41568106823 is `waiting`. The dashboard report went at
02:5xZ; Main checked first that no sibling had sent one. **Parked on operator: the ready flip**, then
maintainer review. Next touches: the operator's flip or a maintainer comment (webhook), then CI.
Timer for the parked chain: the `/supervise-issues` 12 h tick walks the fixer's active session on
`gh-issue-shader-slang/slang-14200`. No separate one-shot was created, and no recurrence (R10).
