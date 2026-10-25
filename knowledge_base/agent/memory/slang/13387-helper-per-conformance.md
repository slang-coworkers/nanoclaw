---
type: chain
title: slang PR #13387 — Add opt-in whole-helper specialization per conformance
description: "Fork PR by jvepsalainen-nv (head codex/helper-per-conformance, linked issue #13245). 2026-10-24 saipraveenb25 asked the bot to rework it to an extension-based design; dispatched to slang-fixer (pr-review-fix)."
---

# slang PR #13387

- **Shape:** cross-repo fork PR (`jvepsalainen-nv/slang`, `maintainerCanModify=true`), human author
  jvepsalainen-nv. Fixes issue #13245, whose triager chain is parked `advisory:maintainer-driving`
  (supervisor-state).
- **Approver:** never forwarded. `slang-pr-approver` is paused (see [../pr-approvers-paused.md](../pr-approvers-paused.md)).
  The PR is listed in `approver-pause-followup-b5f2` (head `41e6e4fbe4db` at 10-06).
- **2026-10-24 06:06Z:** saipraveenb25 asked `@nv-slang-bot` to update the PR to the design they described
  (issuecomment-6380710649). In that design, `extension T : IFoo { void doThing() {...} }` is allowed, lowering
  `doThing` as a generic tags `T` for per-conformance specialization, and a type-set argument for `T` is
  resolved by one specialization per unique type. It replaces the experimental flag.
  Dispatched to `slang-fixer` (MODE=pr-review-fix, `<github-post-authorized />`), in_reply_to webhook row 30, on
  thread `gh-pr-shader-slang/slang-13387`. No fixer session existed before the dispatch; the owner is now `sess-1792822114720-gon9vt` (running, dispatch msg 37). Live head was `41e6e4fbe4db` (5 commits).
- **10-24 06:14–08:52Z (verified by Main on GitHub):** the fixer did not push to the author's branch. It posted an ack
  (issuecomment-6380783150) and four scope questions with bold defaults (issuecomment-6380910103). The questions cover the
  `extension T : IFoo` spelling (rejected today with E30015, so the fixer tags the `T` in `extension<T : IFoo> T`),
  E33180 for T-dependent result / `[mutating]`, dropping the limits and warning 55219, and legacy-mode copies.
  It then posted the proposal (issuecomment-6382216077): three commits on `slang-coworkers/slang:fix/issue-13387` at
  `f4398e26ab7c`, on top of `41e6e4fbe`, that the author can take with `git pull --ff-only`. The PR head is still
  `41e6e4fbe4db`. The fixer sent an HTML explainer (a2a msg 42) but no 5-bullet [Report]. **Parked on saipraveenb25's
  answers.** The reply arrives by webhook to the fixer's mapped session. Caveat: the branch reuses stable IDs 907/908,
  which master now takes, so they need renumbering at the next master merge.
- **10-24 08:54Z interim [Report] (a2a msg 44), the fixer's own claims, not checked by Main:** full suite 10118/10121 at
  `f4398e26a` on L40S (3 fp8-cuda environment failures, the same as on master). Focused tests 2052/2052, run on cpu/vk/cuda.
  Critique gates passed. slang-reviewer A+C peer review is running (~90 min); a [Fix Report] follows. The fixer cannot open
  a PR into `jvepsalainen-nv/slang`: the API returns HTTP 401 even for a GET, and there is no user PAT. That is an access
  gap, not a broken credential. The 111 KB patch is over GitHub's comment size limit, so the fixer offers a
  `--ff-only` pull instead. **I held the operator roll-up until the [Fix Report]**, because the 08:52Z dashboard
  5-bullet already covered the state.
- **10-24 10:58Z interim [Report] (a2a msg 46):** slang-reviewer round 1 returned REQUEST_CHANGES with 0 bugs and 6 gaps.
  The fixer applied all 6 in 5 forward commits; head is `02585b8f3`, 8 commits on top of `41e6e4fbe`. Stable IDs were renumbered to
  910–912. The fixer reports a full suite of 10136/10139 (the same 3 fp8-cuda failures) and focused suites of 2070/2070.
  The round-2 review is running. The 4 maintainer questions are still open. The operator roll-up is still held until the [Fix Report].
- **10-24 12:45Z [Fix Report] (a2a msg 50). Verified by Main:** the branch head is `8c5bb99ebc78`, 11 commits ahead and 0 behind
  `41e6e4fbe4db`, touching 29 files. The status comment was edited at 12:43Z and now adds Q5. The PR head is unchanged and there is
  no human comment since 06:06Z. **Fixer's claims:** full suite 10141/10144 (the 3 known fp8-cuda failures), focused tests 59/59.
  slang-reviewer requested changes twice; round 2 was the last round. L5 is left unfixed. L5 is a false E33180 when one dynamic
  value reaches a generic function both directly and through another generic. The fixer says it is a **pre-existing master bug**
  that reproduces on 2026.13.1 (repro in the fixer's `reports/13387-l5-master-repro.slang`). It could be filed as its own master
  issue, and the operator has been asked about that. **State: partial, parked on saipraveenb25's answers to Q1–Q5.**
  Timer: `slang-13387-maintainer-r-c5d6`, a one-shot task at 2026-10-27 13:00Z. supervisor-state has no `gh-pr-*` keys,
  so supervise-issues does not cover this chain.
