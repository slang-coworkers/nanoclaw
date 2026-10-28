---
type: project
name: project_13941_vswhere_build_tools_products
description: "HELD 10-25 12:2xZ, no dispatch, no bot post. slang#13941 (albertrodriguezclo, external): on Windows with only VS 2022 Build Tools, _findVersionsWithVSWhere (slang-win-visual-studio-util.cpp) omits vswhere -products *, so no visualstudio/genericcpp downstream compiler and every slang-test cpu lane is 'ignored'. The reporter's own non-draft fix PR #13942 (fix/vswhere-all-products, 'Fixes #13941', one file) opened 3 s later; auto-assigned to jkwak-work by github-actions[bot]."
---

# slang#13941: vswhere misses Visual Studio Build Tools installs

**10-25 12:20:54Z `issue_opened`.** Main webhook session `sess-1792930856843-j15yc0` (the only session on
`gh-issue-shader-slang/slang-13941`). Live read 12:2xZ: open, 0 comments, no labels, CONTRIBUTOR,
`updated_at` 18 s after `created_at` (the auto-assign).

**Report (not verified by us):** `vswhere -format json -utf8 -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64`
without `-products` searches only Community/Professional/Enterprise, so a Build Tools-only machine finds no
Visual Studio. Fix: pass `-products *`.

**Ownership:** timeline shows `cross-referenced` from the reporter's PR **#13942** (12:20:57Z, non-draft,
body "Fixes #13941", touches only `source/compiler-core/windows/slang-win-visual-studio-util.cpp`), then
`assigned` (github-actions[bot] → jkwak-work, an auto-assign). A human report with the reporter's own open
fix PR is held (rule 4 of [feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new](feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new.md)):
no triager, no fixer, no GitHub post. Not routed to the PR review path either: #13942 is a human PR with
no @nv-slang-bot mention.

**Resume on:** an @nv-slang-bot mention on #13941/#13942, #13942 closing unmerged, or an operator ask.

Same-batch sibling: PR #13943 (Metal `-fno-fast-math` for `-fp-mode precise`, 12:21:00Z), its issue is
routed by its own Main. Earlier siblings: [#13931](project_13931_sv_clipdistance_vector_form.md),
[#13916](project_13916_wgsl_atomic_vec2u_min_max.md).

**10-27 `pr_ready_for_review` (synchronize) on #13942** at head `d3c97471`: jkwak-work APPROVED; CI 55 pass / 1 pending. Not forwarded: slang-pr-approver is paused. Queued in `data/approver-pause-queue.md`.
