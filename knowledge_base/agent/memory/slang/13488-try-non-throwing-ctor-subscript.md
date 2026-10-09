---
type: chain
description: slang#13488 — `try` on non-throwing ctor/subscript not diagnosed; PR #13503 approved by skiminki-nv + flipped ready by them 2026-10-08, awaiting dshreiner-nv review/CI/merge; autodiff-throws regression follow-up filed as #13508 (unrouted).
---

# slang#13488 — `try` on a non-throwing constructor/subscript is not diagnosed

- **Reporter:** skiminki-nv (2026-10-07). Same reporter as #13489 (accessor errors), which is a separate chain: draft PR #13502 changes only
  `slang-check-decl.cpp`, so there is **no file overlap** with #13503 (checked live 2026-10-07; my earlier conflict warning was wrong).
- **Maintainer ask (comment 6043430566, verbatim):** "@nv-slang-bot : Please review. Draft a PR to add the missing diagnostics."
  Routed THROUGH slang-triager (ANCHOR H) with `<github-post-authorized />`.
- **Triage:** comment 6043897721 (bot); labels reproduced + Missing Diagnostic. bug / medium / frontend / P2, not a regression.
  Root cause: `visitTryExpr` (`slang-check-expr.cpp` ~7778) read the error type only from `FuncDecl`.
- **Fix:** draft PR **#13503** (`fix/issue-13488`), mapped to slang-fixer session `sess-1791396460019-z1yzez`. The error type now comes from
  `as<FuncType>(callee->type)` with a release assert. Round-1 review 🔴 (assert reachable via an erroneous overloaded callee) was fixed in the
  producer (`CompleteOverloadCandidate` returns an error expr). Round-2 review: 0 bugs, 3 gaps, all addressed in round 3.
  Head **4a8e277605** (2026-10-08 02:14Z): 3 commits, 6 files +365/−13, `pr: non-breaking`, 0 GitHub reviews, CI draft-gated.
- **Disclosed maintainer questions (in PR body):** (1) is `pr: non-breaking` right (`try int(3.0)` / `try buf[0]` now give E30091);
  (2) the #12362 `findErrorHandler` hang becomes reachable through generic-error-type code.
- **Follow-up (autodiff of `throws`):** a `[Differentiable] ... throws` declaration alone fails with E38105 ×3 (fwd_diff/apply_bwd/remat).
  This is a regression since v2026.7, with #9808 a candidate cause (not bisected); master also hits E99997 at check-decl.cpp:10862.
  Draft at `/workspace/inbox/a2a-1791425695614-vth41o/draft-13488-autodiff-throws.md`; my dedup search found nothing.
  **2026-10-08 02:17: I told the triager YES, file it.** Filing a checked issue is not operator-gated (see
  [feedback_github_writes_operator_authorized](../imported/feedback_github_writes_operator_authorized.md)); this was the 13350/#13355 precedent.
  It stays unrouted, with no fix authorized.
  **2026-10-08 02:19: filed as [#13508](https://github.com/shader-slang/slang/issues/13508).** Checked live: bot author, Type=Bug,
  labels reproduced+regression+Autodiff, no assignee, body 5016 chars. The triager asked the fixer for a body-only "tracked in #13508" line on #13503.
- **Re-chase:** `rechase-13488-pr13503-73bf` fires 2026-10-10 09:00Z. It checks human activity on #13503/#13488, that the follow-up was filed
  and the PR body references it, and the draft/CI state.
- **2026-10-08 07:57Z (checked live):** skiminki-nv **APPROVED** at 4a8e277605 (review 5453505285, "LGTM") and **flipped the PR to
  ready themself** (timeline `ready_for_review` actor = skiminki-nv, so the operator gate wasn't touched). They requested dshreiner-nv's review. MERGEABLE, merge state
  BEHIND, and the PR body references #13508. CI run 37746639315 was in progress with 0 failures at 08:09. The `pr: non-breaking` question is still unanswered.
  Next: dshreiner-nv review → CI → maintainer merge, which auto-closes #13488. Merge stays with the maintainer or the operator, never the bot.
