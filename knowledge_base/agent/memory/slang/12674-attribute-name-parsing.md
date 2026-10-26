---
type: chain
title: slang PR #12674 — attribute-name parsing (fix/issue-12668)
description: nv-slang-bot PR for #12668. jkwak-work's 10-01 review was addressed in a330cc863c and held 23 days on a maintainer question; pushed 10-24 (head c7879c5a31) with a no-ping reply. PARKED on the maintainers' fold question; replies arrive by webhook to the fixer session.
tags: [slang, parser, attributes, pr, awaiting-maintainer, parked]
---

# slang PR #12674 — attribute-name parsing

- **Owner:** slang-fixer session `sess-1787273918518-t41g0t`, thread `gh-issue-shader-slang/slang-12668`.
  Branch `fix/issue-12668`, not a draft. Follow-up issue #13374 tracks the 202c deprecation (assigned to
  jkwak-work, milestone Q4 2026).
- **Open question** ([discussion_r4158971751](https://github.com/shader-slang/slang/pull/12674#discussion_r4158971751),
  10-01 18:26Z): csyonghe's 08-27 review wants the checker to rebuild the `_`-joined fallback from
  `attributeNameExpr`. jkwak-work's 10-01 ask has the parser return the folded legacy token instead.
  Doing both folds the name twice. Local `a330cc863c` uses the token directly.
- **10-03 → 10-21:** seven re-chases (`rechase-12674-legacy-tok-*`) found no reply and no push. From 10-06
  on, six of them asked the operator to pick: (a) the bot @-mention bump, (b) the operator pings, or
  (c) keep waiting. None of the asks got an answer.
- **10-24 09:0xZ (9th check):** still no reply. The head was still `fcd7eeefaf`, 166 behind master and
  MERGEABLE. I withdrew the operator ask as over-gated: the menu never offered the no-ping default, and
  a code push to our own branch was never gated
  ([gating leaf](../imported/feedback_github_writes_operator_authorized.md)). I dispatched the fixer
  pinned (msg id 17) to do a plain master merge, re-test, CODE_REVIEW, push, post ONE no-ping reply that
  keeps the question open, and refresh the PR description. The @-mention ping is still an operator
  opt-in only.
- **10-25 09:00Z verification (`rechase-12674-post-push-40e7`):** fixer pushed 10-24 09:2xZ with no force: a
  plain master merge `b58d58ad05` plus a comment trim, giving head `c7879c5a31`. It was still OPEN, MERGEABLE and
  BLOCKED (no approval). Tests: attribute 4/4, language-server 79/79, diagnostics 948/948. `pull_request` CI
  run 40081518361: 53 pass. The only fail is `board-sync` (a 4 s project-board job, not code). Pending:
  `falcor-build-approval-gate` and `license/cla`. The no-ping reply is in the same thread:
  [r4366687639](https://github.com/shader-slang/slang/pull/12674#discussion_r4366687639). No maintainer
  reply, review or comment since 10-24. Fixer's own note: CODE_REVIEW item R2 is still open and codex marks
  it merge-blocking (it did not block the push).
- **State: PARKED on the maintainers** (csyonghe vs jkwak-work fold question). No more re-chases. Webhooks
  bring maintainer replies to the fixer session. The @-mention ping is still an operator opt-in only.
