---
type: project
name: project_13944_target_desc_resets_session_fp_mode
description: "HELD 10-25 12:4xZ, no dispatch, no bot post. slang#13944 (albertrodriguezclo, external): Linkage::addTarget(TargetDesc) (slang-session.cpp) inherits session options then unconditionally sets FloatingPointMode / LineDirectiveMode / GLSLForceScalarLayout from the TargetDesc defaults, so session-level -fp-mode precise (incl. render-test -Xslang) is lost. The reporter's own non-draft fix PR #13945 (fix/target-desc-keeps-session-options) opened 3 s later; auto-assigned to kaizhangNV by github-actions[bot]."
---

# slang#13944: a TargetDesc default resets session-level fp / line-directive modes

**10-25 12:37:38Z `issue_opened`.** Main webhook session `sess-1792931860451-m36yju` (the only session on
`gh-issue-shader-slang/slang-13944`). Live read 12:4xZ: open, 0 comments, no labels, CONTRIBUTOR,
`updated_at` 22 s after `created_at` (the auto-assign).

**Report (not verified by us):** `Linkage::addTarget(slang::TargetDesc const&)` calls
`optionSet.inheritFrom(m_optionSet)` and then sets `FloatingPointMode`, `LineDirectiveMode` and
`GLSLForceScalarLayout` from the `TargetDesc` unconditionally, so a `SessionDesc::compilerOptionEntries`
`Precise` (or `LineDirectiveMode = None`) is replaced by the `TargetDesc` default. Visible effect:
render-test's `-Xslang -floating-point-mode -Xslang precise` does nothing on any backend.

**Ownership:** timeline shows `cross-referenced` from the reporter's PR **#13945** (12:37:42Z, non-draft),
then `assigned` (github-actions[bot] → kaizhangNV, an auto-assign). A human report with the reporter's own
open fix PR is held (rule 4 of [feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new](feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new.md)):
no triager, no fixer, no GitHub post. Not routed to the PR review path: #13945 is a human PR with no
@nv-slang-bot mention.

**Resume on:** an @nv-slang-bot mention on #13944/#13945, #13945 closing unmerged, or an operator ask.

Same-reporter siblings: PR #13943 (Metal `-fno-fast-math` for `-fp-mode precise`) is the Metal half of
the symptom this issue names; [#13941](project_13941_vswhere_build_tools_products.md) / PR #13942 was held
the same way 17 min earlier.
