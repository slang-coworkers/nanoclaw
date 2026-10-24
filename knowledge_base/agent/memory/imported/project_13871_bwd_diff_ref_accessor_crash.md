---
type: project
name: project_13871_bwd_diff_ref_accessor_crash
description: "slang#13871 (jhelferty-nv, 10-22 15:49Z, self-assigned + saipraveenb25, label Autodiff): bwd_diff through a `ref` subscript accessor with a __func_extension bwd derivative segfaults (Release rc 139 on cpp/hlsl/spirv/cuda) / asserts index < getParamCount() (debug). Asks: bridge ref→value derivative, or diagnose like E38036. Repro CONFIRMED on master 0bd71cd709. HELD: maintainer-owned, no dispatch, no bot post; operator asked whether to triage. Re-check rechase-13871-4887 ran 10-23 12:01Z: no change, still held; no further timer."
metadata:
  node_type: memory
  type: project
---
**2026-10-22 15:49Z, `issue_opened`.** Live read about 15:52Z: OPEN, 0 comments, label `Autodiff`, body = payload
(3537 B). Author jhelferty-nv (MEMBER). `/events` `assigner=jhelferty-nv` for both assignees (themself and
saipraveenb25), so it is a self-assign plus the autodiff owner. Timeline: only those label/assign events, no
cross-referenced PR. Only session on `gh-issue-shader-slang/slang-13871` is this Main webhook session (`6c53u1`); no
task.

**What it reports.** A `__subscript` with only a `ref` accessor on an `IDifferentiable` struct, with custom
`fwd_diff`/`bwd_diff` attached via `__func_extension ...(RefCell::__subscript::ref)`. Differentiating a caller
(`c[0] * 3.0`) with `bwd_diff` crashes. The open question is the author's design question: bridge the returned
reference to the value-shaped derivative, or reject a `ref` accessor on a differentiable type (like E38036, whose text
names `[constref]` even for `[__ref]`). Related: [[project_9636_ref_accessor_invalid_code]] (ref accessors emit
invalid code, policy-gated), [[project_12031_autodiff_ref_accessor_silent_wrong_grad]] (the PR that added the
accessor-derivative syntax; its compile-only test `tests/autodiff/func-extension/subscript-ref-accessor.slang`).

**Main's repro at master `0bd71cd709` (local Release slangc), artifacts in
`/workspace/agent/reports/triage/repro-13871/`:**
- `bwd_diff`: rc 139 on `-target cpp`, `hlsl`, `spirv`, `cuda`. Matches the body.
- `fwd_diff` variant: rc 0, but `s_fwd_useIt_0` emits `{ *_S7 * 3.0f, 0.0f }` where `_S7` is a `DiffPair_float_0`
  (not a pointer) and the differential is hardcoded `0.0f`. This is the same shape the reviewer found on #12031
  in July (`{ *_S7, 0.0f }`): invalid C++ and a dropped gradient.
- The debug assertion text matches #13748's (`index < getParamCount()`), the same author's `fwd_diff` on a `__ref`
  parameter crash. Main's guess at a shared root, not verified.

**Why held.** Rung 4 of [[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]]: same author and shape
as [[project_13748_fwd_diff_ref_param_crash]] (held, operator asked 10-19, no answer yet) and #13747/#13838. It is a
finished diagnosis, assigned to the autodiff owner, and its open question is a design call for them. R6 (#13596)
says the bot waits on human issues. As with #13748, the crash-with-reproducer exemption in nanoclaw draft #1993
would deliver it, so the call is the operator's.

**Resume on:** an @nv-slang-bot mention, an operator ask, a linked PR, or the issue being unassigned. Re-check task
`rechase-13871-4887` (10-23 12:00Z) re-reads live state.

**2026-10-23 12:01Z re-check (`rechase-13871-4887`): no change.** Live: OPEN, 0 comments, assignees jhelferty-nv +
saipraveenb25, `updated_at` still 10-22 15:49Z; timeline = only the label/assign events, no cross-referenced PR. No
coworker session on the issue (only Main's `6c53u1` and the task session). Dashboard (bounded read, 400 rows to
11:58Z): no operator answer on #13871 or #13748. Reported one line to `orchestrator-dashboard`; not rescheduled (the
task said not to). Still resumes on the triggers above.
