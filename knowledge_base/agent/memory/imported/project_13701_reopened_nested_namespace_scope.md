---
type: project
name: project_13701_reopened_nested_namespace_scope
description: "slang#13701 (skiminki-nv, 10-16, self-assigned): `namespace A::B {}` reopening an existing B skips existing enclosing namespaces in the scope chain (parseNamespaceDecl pushes the parent scope only for newly created components). Maintainer go 12:47Z ('@nv-slang-bot Reproduce and draft a fix PR.', cmt 6215822491) -> slang-fixer dispatched on gh-issue-shader-slang/slang-13701. Must compose with our stale draft #11449 (#11442, same PushScope lines). TERMINAL: PR #13711 MERGED 10-16 20:12Z (bbd75ba782), issue closed; follow-up #13714 assigned to skiminki-nv, held."
metadata:
  node_type: memory
  type: project
---

# slang#13701 — reopened nested namespace loses enclosing scope

- **Filed** 2026-10-16 12:45Z by skiminki-nv, self-assigned, 0 comments. By itself this would be held (see
  [[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]] rung 4, a maintainer-owned item).
- **Go** 12:47Z: `@nv-slang-bot Reproduce and draft a fix PR.` (cmt 6215822491; the live body matches the payload).
- **Dispatched** to slang-fixer, MODE=fix-issue, `<github-post-authorized />`, thread `gh-issue-shader-slang/slang-13701`.
  It is told to ack on the issue first, then open a draft PR on `fix/issue-13701` with `report_pr_created`.
- **Coordination:** #11449 is our own bot draft for #11442 (head `fix/issue-11442`, last updated 07-29, no reviews, assigned to
  skiminki-nv). It changes the same `PushScope(parentDecl)` lines. No live session or pr-mapping owns it. The fixer was told to read
  it and compose with it, and not to touch its branch without asking.
- **10-16 15:10Z fixer report (in progress):** reproduced E30015 and fixed locally on `fix/issue-13701` in 3 commits (repro test,
  `pushLookupScope` refactor, fix). PLAN_REVIEW approved. The fixer reports the suite green apart from 3 pre-existing fp8-cuda failures
  (not yet verified by Main). Fixer's finding: when a component is found, the fix pushes a lookup-only scope and leaves `ownedScope` alone,
  and #11449's create-branch line is unchanged, so the two compose. Next: CODE_REVIEW, then push the draft PR.
- **10-16 15:37Z draft PR #13711** (head 408a077, `fix/issue-13701`, 4 files +214/-1, pr-mapping -> slang-fixer
  sess-1792154889940-6nyi11). `Fixes #13701` only. The fixer checked that #11449 applies cleanly on top and that namespaces tests pass 24/24
  with both. Labelled `pr: breaking change`: with the fix, `A`'s members hide same-named globals inside `namespace A::B` (as the nested
  spelling already does), so a few programs that compiled now error (E30060 probe). **Open maintainer question (blocks merge):** keep
  breaking or relabel non-breaking. Known gap left alone: `A`'s imported/`__include`d members are still not visible (that is #11442's area).
- **10-16 15:50Z:** ack 6215848829 edited to link #13711 (verified). Sent to slang-reviewer. Full suite 10665/10668; the 3 fp8-cuda
  coop-matrix failures look unrelated. They match the 3 that failed on master in the #13633 run (10215/10218 at 82be82e). The 3 tests only
  `using namespace linalg`, and no core-module `.slang` file declares a qualified `namespace A::B`, so the parser change can't reach them.
- **10-16 15:59Z skiminki-nv review (COMMENTED):** "The fix looks correct to me". He checked that pushes and pops stay balanced, and
  that with #11449 on top, namespaces + name-lookup pass 63/63. He made 3 asks, all done by the fixer at head 3271517772 (verified):
  (1) follow-up **#13714** filed (bot, unassigned): imported members of `A` are invisible in `namespace A::B` when `B` exists, still so with
  #11449; (2) relabelled `pr: non-breaking`, his call: a bug fix toward the documented equivalence, so the label question is CLOSED; (3) every
  CHECK value is anchored `{{^}}N{{$}}`. The parser diff is unchanged since 408a077.
- **10-16 16:17Z** skiminki-nv marked #13711 ready for review himself (timeline actor checked); **16:19Z APPROVED** head 3271517772.
  CI at 16:20Z: 13 pass, 18 pending, 0 fail; mergeable_state `blocked` (pending checks). Label `pr: non-breaking`.
- **10-16 17:27Z [Fix Report]:** slang-reviewer APPROVE_WITH_NITS (0 bugs). The fixer pushed its nits after the maintainer approved, as
  953811ad61 + 3acdd78507. I checked that the `.cpp` delta is comments only and the rest is tests. **That push DISMISSED skiminki-nv's 16:19Z
  approval**; the fixer asked him on the PR (17:26Z) to re-approve. Head is 3acdd78507 and CI was re-dispatched (12 pass, 18 pending).
  Cost: one extra human round for non-blocking nits. Flagged to the operator as a possible rule (hold non-blocking nits once a maintainer approves).
- **10-16 17:43Z** skiminki-nv re-approved head 3acdd78507 (verified). CI 31 pass / 22 pending / 0 fail. slang-reviewer chain closed.
- **10-16 19:04Z** the PR run 38938669813 failed only `test-falcor`, in step "Run external CI" (I couldn't read the log). Falcor also failed
  the same afternoon on 3 other branches (38936803952, 38934910845, 38928933829, verified) -> infra. The fixer re-ran the failed jobs
  (attempt 2), cap 3, then escalates. The 18:06Z failure was the fixer's own duplicate `workflow_dispatch` run (bot-yield jobs), so not actionable.
- **TERMINAL 10-16 20:12Z:** #13711 MERGED by skiminki-nv as bbd75ba782; #13701 CLOSED completed (both verified). The fixer removed worktree
  `wt-slang-13701` and its sentinel. Took 7.5 h from filing to merge, with 2 maintainer reviews.
- **#13714** follow-up (bot-filed): now assigned to skiminki-nv, 0 comments, no labels -> maintainer-owned, held: no dispatch.
  Resume only on an @nv-slang-bot mention or an operator ask.
- **Open operator question (unanswered at close):** should fixers hold non-blocking peer nits once a maintainer has approved? Here the push
  dismissed his approval and cost one re-approval round.
