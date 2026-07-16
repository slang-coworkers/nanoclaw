---
name: project_11029_constexpr_param_autodiff_not_fixed
metadata: 
  node_type: memory
  type: project
  originSessionId: 8b739018-26c4-4c97-868d-07ddd6559270
---

shader-slang/slang#11029 — `[BackwardDerivative]` fn with `constexpr int mode` param loses the constexpr rate qualification in the synthesized backward-prop wrapper → `error[E41402]: static assertion condition not compile-time constant`. Regression from the big autodiff refactor (HYP #9808).

2026-07-15: jkwak-work asked (via issue webhook) to re-triage, suspecting "might be already fixed." slang-triager verified EMPIRICALLY at HEAD 694022a11 (slangc 2026.12.2-60) → **NOT fixed**. Reproduces on both `-target spirv` and `-target hlsl`; same fn WITHOUT autodiff compiles clean → autodiff-bwd-synthesis specific. Verdict posted: issue comment 4982855570; labels `reproduced`+`regression`.

**Maintainer-owned — do NOT dispatch a bot fixer.** Issue is self-filed by jkwak; his own PR #11030 (`Fixes #11029`, WIP/OPEN/unmerged since 2026-05-02) is the fix path. Carries @saipraveenb25 steer: reuse existing ForceInline constexpr-param model + re-run constexpr propagation after finalizeAutoDiffPass, rather than a new pass. No merged fix, no in-tree regression test yet. Chain closed at verified verdict.

**2026-07-15 (2nd webhook, comment 4985091568):** jkwak reassigned the issue to @saipraveenb25 — "we discussed... a fix coming soon, which was a few weeks ago. It appears that the issue is still open. Please investigate it when you come back from SIGGRAPH." This CONFIRMS our NOT-fixed verdict (no dispute/gap), and is a maintainer→maintainer handoff (saipraveenb25 now assignee, directive addressed to him, not the bot). Disposition: STAND DOWN — no re-triage (verdict stands, jkwak agrees), no bot comment (maintainers coordinating in the open; our verdict already public; a bot reply would be noise). saipraveenb25 owns it post-SIGGRAPH via #11030.

Ties to [[feedback_triage_github_posting]] (verified → POST), [[feedback_deadpromise_check_assignee_before_rewake]] (self-assigned maintainer ⇒ stand down).
