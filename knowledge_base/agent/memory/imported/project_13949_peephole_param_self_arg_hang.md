---
type: project
name: project_13949_peephole_param_self_arg_hang
description: "HELD 10-25 21:33Z, no dispatch, no bot post. slang#13949 (albertrodriguezclo, external): slangc hangs in peepholeOptimize when a loop header block param gets undefined from the entry edge and itself from the back edge; the kIROp_Param case in slang-ir-peephole.cpp takes the param itself as the single incoming value, replaceUsesWith(inst) is a no-op, changed=true forever. The reporter's own non-draft fix PR #13950 (fix/peephole-hang, 'Fixes #13949') opened 5 min later."
---

# slang#13949: peephole hangs on a loop-carried param whose only other input is itself

**10-25 21:28:01Z `issue_opened`.** Main webhook session `sess-1792963683468-3zjt5f` (the only session on
`gh-issue-shader-slang/slang-13949`). Live read: open, 0 comments, no labels, no assignee, body unchanged.

**Report:** `float x;` written only under `if (kEnabled)` with `static const bool kEnabled = false` (or a
link-time `extern static const`) inside a `for` loop hangs slangc on spirv/glsl/hlsl. Proposed fix: skip
an incoming argument equal to the param itself, as `IRUndefined` arguments are skipped (trivial-phi rule).

**Code check (ours, not a repro):** `slang-ir-peephole.cpp:1672-1740` on master 52e29ab43 has no `arg == inst`
exclusion, so a self-only back edge sets `argValue = inst`. `domTree->dominates(inst, inst)` then holds and
`changed = true` on every sweep. Matches the report.

**Ownership:** the body said "PR to follow" and no PR existed at the first read, so I waited for a timeline
`cross-referenced` event. PR **#13950** ("Peephole: ignore a block param's own value among its incoming
arguments") came 21:33:15Z: non-draft, touches `slang-ir-peephole.cpp` + `tests/bugs/gh-13949.slang`,
reviewer dshreiner-nv. A human report with the reporter's own open fix PR is held (rule 4 of
[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new](feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new.md)).
A "PR to follow" body is the same case, once the PR exists: a bounded until-loop on the timeline (≤10 min) settles it.

**Resume on:** an @nv-slang-bot mention on #13949/#13950, #13950 closing unmerged, or an operator ask.

Same-author siblings: [#13941](project_13941_vswhere_build_tools_products.md), [#13924](project_13924_wgsl_metal_fragment_return_semantic.md).

**10-28 ~22:33Z:** #13950 `pr_ready_for_review` (synchronize) at head 39f8b1ec; approvers paused, so not forwarded; queued in `data/approver-pause-queue.md`. Chain stays held.
