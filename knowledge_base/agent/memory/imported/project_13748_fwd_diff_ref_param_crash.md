---
type: project
name: project_13748_fwd_diff_ref_param_crash
description: "slang#13748 (jhelferty-nv, 10-19 15:47Z, self-assigned + saipraveenb25, label Autodiff): fwd_diff of a fn with a __ref param segfaults (Release rc 139) / asserts index < getParamCount() in TypeFlowSpecializationContext::getParamInfos during finalizeAutoDiffPass. Forward counterpart of #12393; blocks a #13406 regression test. Repro CONFIRMED on master 68438b5e18. HELD: no dispatch, no bot post; operator asked whether to triage. Re-checked 10-23 12:00Z: still open, no fix PR, still held; saipraveenb25 unassigned 10-21; no reschedule."
---

# slang#13748: `fwd_diff` on a `__ref` parameter crashes in `finalizeAutoDiffPass`

**10-19 15:47Z, `issue_opened`.** Live read about 15:49Z: open, author `jhelferty-nv`, assigned to themself and
`saipraveenb25`, label `Autodiff`, 0 comments, timeline shows only their assign/label events, no cross-referenced PR.
Only my webhook session `sess-1792424863007-mw6z26` was on `gh-issue-shader-slang/slang-13748`. `gh search` found no
duplicate. `slang-triager` is not paused.

**Repro on master `68438b5e18` (local Release slangc):** rc 139 on `-target cpp`, `spirv`, `hlsl`. The
`no_diff __ref` control compiles (rc 0). This matches the body. The body's root-cause line ("splits the `__ref`
parameter into a primal and a differential part") is their unverified guess.

**Why held.** The body is a finished diagnosis by a maintainer who assigned it to themself and the autodiff owner,
and it names their own downstream (#13406 regression test, which they own). They told the bot to stand down on #13406
on 10-16 (issuecomment-6224584448); that instruction was on a PR, not this issue, so it doesn't strictly cover
#13748, but the pattern (self-assigned maintainer item, #12035/#12113/#13550 precedents) is a hold. R6 (#13596,
gate in nanoclaw draft #1993) also says the bot waits on human-filed issues. The crash-with-reproducer exemption in
#1993 would deliver this one, so the call is the operator's.

**Next.** Operator decides: triage (slang-triager on the canonical thread, investigation only, no fixer) or keep the
hold. Re-check task `rechase-13748-fwd-diff-r-8dd5` (10-23 12:00Z) re-reads live state. Resume on an @nv-slang-bot
mention, an operator ask, or a linked PR. Related: [[project_12393_bwddiff_ref_param_abort]],
[[slang/11709-groupshared-param-by-reference.md]] (the #13406 hold).

**10-23 12:00Z re-check (`rechase-13748-fwd-diff-r-8dd5`).** The issue is still open with 0 comments, and no
@nv-slang-bot mention. Assignee is now `jhelferty-nv` only, because they unassigned `saipraveenb25` on 10-21 17:52Z.
Other changes: `jkwak-work` added milestone "Q4 2026 (Fall)" on 10-19, and an issue type was set on 10-21. The
10-22 `referenced` event is commit `0bd71cd709`, the squash of bot PR #13406 (merged 10-22 08:47Z; the copy that
referenced the issue is in `jkiviluoto-nv`'s fork). That commit message lists #13748 as a known limitation
("`fwd_diff` of a function with a reference parameter crashes (#13748), as `__ref` already does on master"). It is
not a fix. No linked fix PR exists. The last 400 dashboard rows have no operator answer. The only coworker session is
the stopped webhook session. Still held: the operator has not decided between triage and keeping the hold. No
reschedule (per the task). Resume on an @nv-slang-bot mention, an operator ask, or a linked PR.
