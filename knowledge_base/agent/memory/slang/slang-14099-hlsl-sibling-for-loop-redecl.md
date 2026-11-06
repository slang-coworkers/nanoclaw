---
type: chain
description: "Human-filed (pdeayton-nv, MEMBER, bot-ok) HLSL bug 10-30: sibling `for (int i…)` loops give E39999+E30200 under -lang hlsl, plus a silent miscompile. Long-standing FXC-style UnscopedForStmt leak. tangent-vector directed approach B (DXC scoping, breaking) → draft PR #14115, R1 APPROVE_WITH_NITS; 11-02 tangent-vector CHANGES_REQUESTED (comment quality, \"should probably be ready to go\") addressed in 4b3a2c467; 11-04 jhelferty-nv un-drafted it; DIRTY (slang-ir.h module-version conflict) so no CI → 11-05 fixer merged master (head 7ec530a47, module version 39), tangent-vector approved and enabled squash auto-merge (our push dismissed the approval as stale); then CI RED on the private compile-regression suite (495_preprocessed_ps.hlsl, likely the accepted breaking change, unverified), so auto-merge was blocked; 11-05 21:06Z tangent-vector CLOSED #14115 to do a backwards-compatible option; the bot stands down with approach A offered; 11-05 21:04Z tangent-vector opened their own PR #14360 (\"Supersedes #14115\", Fixes #14099): chain terminal for the bot. Spawned #14118 and #14120."
tags: [hlsl, scoping, for-loop, frontend, r6-exempt]
resource: raw/triage-14099.md
---

# shader-slang/slang#14099 — HLSL sibling for-loop variable redeclaration

This chain also owns the two follow-ups it spawned: [[slang-14118-unbraced-body-local-visible-early.md]]
(PR #14119) and [[slang-14120-target-switch-catch-for-local-visible-early.md]] (parked). Both were
bot-filed by the triager session below, so **their `issue_opened` webhooks need no dispatch**.

## State (10-31 04:20Z)

| | |
|---|---|
| Issue | filed 10-30 19:47:08Z by pdeayton-nv (MEMBER, self-assigned), label `bot-ok` → R6 hold waived; labels `reproduced`+`bot-ok` |
| Triage | 10-30 20:13Z ready-for-fix, bug/high/frontend/P2; comment #issuecomment-6532516576; memo `raw/triage-14099.md` |
| Sessions | triager `sess-1793389741238-u9zfkk`; fixer `sess-1793391263352-okyiy6` (ag-1780667166439-vmjrwe); thread `gh-issue-shader-slang/slang-14099` |
| PR | **#14115** "Scope HLSL for-loop variables to the loop", **NON-DRAFT since 11-04 18:31Z (jhelferty-nv)**, CONFLICTING, branch `fix/issue-14099`, `pr: breaking change`, head **4b3a2c467** (11-02 comment rewrite; was 42f8ba6d0), pr-mapping → okyiy6 |
| Review | slang-reviewer R1 at ea4cbbfe0: **APPROVE_WITH_NITS 0/0/0** (`raw/combined-review-14115-r1.md`); N1–N5 + C004/FG003 applied in 42f8ba6d0. **11-02 23:18Z tangent-vector CHANGES_REQUESTED**: "Improve the quality of your commenting and this should probably be ready to go." Addressed in 4b3a2c467 (comment-only) |
| CI | none real: dispatch run 41155151526 throttled (`wait-for-human-priority` failed, IS_THROTTLED_BOT, 40 jobs skipped). Un-drafting is the only CI path |
| Parked | 🔚 **#14115 CLOSED by tangent-vector 11-05 21:06Z** ("so we can implement a more backwards-compatible option"). The bot stands down; approach A (non-breaking, unpushed `wip/14099-approach-a`) is offered on #14099 on request. 🔚 **Terminal for the bot (11-05):** tangent-vector opened maintainer PR **#14360** (see log). Timer `recheck-14115-compile-re-2155` cancelled: its case (b) is met |
| Human asks | pdeayton-nv: the rewritten #13219 test (`tests/spirv/debug-lexical-scope-unscoped-for.slang`, reads `i` after the loop); a maintainer: keep/drop the module-version 37→38 commit |

## Re-check log

- **11-02 17:00Z (re-check #1): unchanged → case (e).** #14115 draft @ 42f8ba6d0 and #14119 draft @ 787db86d2; 0 reviews,
  only bot/coderabbit/board-sync comments, CI checks skipped (draft). No human comment on #14099/#14118/#14120 since
  tangent-vector 10-30 22:48Z. No operator reply: Main session `sess-1793389632872-0go3tx` (thread 14099) has no inbound after
  row 192 (10-31 04:19Z). Reminder sent to orchestrator-dashboard on the 14099 thread (msg id 31). No coworker nudged.
  The fired task cannot be `ncl tasks update`d ("no live task matched"), so re-check #2 is a new one-shot.

- **11-02 23:17–23:18Z tangent-vector review on #14115 (CHANGES_REQUESTED).** Inline comment on slang-parser.cpp: "Stop adding *process* information (e.g., issue/PR numbers) as documentation in the codebase. Implementation comments should describe the architecture, design, and approach … written in a more "timeless" fashion … The *process* by which we got here … is already going to be recorded in things like the GitHub issue tracker." Review body: "@nv-slang-bot Improve the quality of your commenting and this should probably be ready to go." 23:36Z: the fixer replied inline (discussion_r4448978121, r4449080918) and pushed 4b3a2c467, which rewrites every comment the PR adds. No behaviour change, affected tests 9/9, CODE/OUTPUT_REVIEW approved, no CI re-dispatch, no reviewers requested. The fixer saved the shared learning (slang-maintainer-rule-no-process-information-issue). I asked the fixer to apply the same rule proactively to #14119, whose tests carry "(gh-14118)" and "option B on gh-14118" comments. The un-draft is still with the operator; the maintainer's "should probably be ready to go" strengthens option (a).

- **11-05 17:00Z (re-check #2, final): changed → case (a).** #14115 was un-drafted by jhelferty-nv 11-04 18:31:23Z (he also
  requested review; pending: pdeayton-nv). It is **CONFLICTING/DIRTY**, and GitHub starts no `pull_request` workflow on a
  conflicting PR. After the un-draft only pull_request_target runs exist, so CI is absent, not red. `git merge-tree` against master 04d2726db0:
  the only conflict is source/slang/slang-ir.h. Master is already at min=max module version 38, which another PR landed (the N5 race). reviewDecision is still
  CHANGES_REQUESTED (tangent-vector 11-02, addressed in 4b3a2c467). The babysitter had flagged it as `merge-conflict` at 11-05 06:00Z, but no one
  dispatched the fixer. **Dispatched the fixer (okyiy6, landed as seq 38, 17:03Z):** merge master (no rebase), bump to 39 if the commit is kept,
  push for full CI, 5-bullet on the PR, and report back. #14119: still parked on #12266 (see its record). #14120: **jkwak-work self-assigned it and set a milestone
  11-02 19:01Z**, so it is maintainer-held and gets no fixer hand-off. No operator reply on the thread. The operator un-draft ask (msg 191) is resolved. Dashboard msg 19
  (status table, plus the cpu+vk/cuda-compile-only correction). **No further timer: all three chains run on webhooks.**

- **11-05 17:23Z fixer [Report]:** merged origin/master 04d2726db with a merge commit, giving head **7ec530a47**. The conflict was `slang-ir.h`: #14051 on master already set the module version to 38, so the PR now sets **39**. Targeted tests 2712/2712. CI run **42071969500** (`pull_request`) is running; `falcor-ci` waits on ci-approvers deployment approval. State comment #issuecomment-6664479114. **tangent-vector enabled squash auto-merge at 17:10:28Z.**
  - ⚠️ **Verified (REST issue events): tangent-vector did NOT dismiss a CHANGES_REQUESTED review.** Their review 5788930729 was an **APPROVAL**. Our merge-master push dismissed it as stale: event `review_dismissed`, actor nv-slang-bot[bot], 17:10:19Z, `dismissal_commit_id` 7ec530a47, `state: approved`. Both the fixer's report and its public state comment wrongly say "tangent-vector has dismissed the earlier review". I asked the fixer to correct the comment in place. **Lesson: a bot push to a PR can dismiss a maintainer's fresh approval; check `issues/<n>/events` `review_dismissed.dismissal_commit_id` before attributing a dismissal.**
  - Merge gating: required checks are check-formatting, check-ci and SlangPy Tests (enforcement non_admins). reviewDecision is empty, so no approval is required. mergeStateStatus is **BEHIND**, meaning strict up-to-date is enforced, so auto-merge waits for a branch update. Plan: after CI on 7ec530a47 is green, the fixer merges master **once** more (merge commit) and lets auto-merge take it. It does not loop.
  - Escalated the `falcor-ci` approval to the operator on the dashboard (14099 thread, msg 223).
  - 11-05 17:30Z: the fixer confirmed the attribution and edited #issuecomment-6664479114 in place (OUTPUT_REVIEW approved, with an "Edited" note). A background watcher is on run 42071969500; check-formatting passed so far. Plan: one master merge if green and BEHIND, triage if red, no chase.

- ⛔ **11-05 17:46Z CI RED on #14115 at 7ec530a47:** `test-compile-regression / Test (Compile Regression)` job 127409129632 failed; verified in the log. The suite passed 865 of 866; `./495_preprocessed_ps.hlsl` is FAIL in all 4 variants (plain, SPIR-V Val, non_semantic_info, non_semantic_info SPIR-V Val), exit 255. Each FAIL takes about 0.3 s, which looks like a compile error, not a crash. The suite is private: `cp -r /c/slang_compile_test_suite_a` on a `[Windows, self-hosted, regression-test]` runner (`.github/workflows/ci-slang-regression-test.yml`). The log has PASS/FAIL only, no diagnostic, and the run has no suite artifact. The same job passed on merge-queue head 4a675860 (#14322, same base 04d2726db), so the failure comes from this PR. Fixer's hypothesis, unverified: an FXC-era shader reads a `for` var after its loop and now gets E30015, i.e. the accepted breaking change. `check-ci` needs this job, so **auto-merge is blocked**. Fixer: no master merge while red. **Needs a human with suite access** to run this PR's slangc on the shader, then update the suite shader or have a maintainer decide. Candidates: tangent-vector (approved, auto-merge); jkwak-work (filed #8217 about this suite). Escalated on the dashboard and offered an opt-in @-mention ping on the PR; the default is no ping (the edited state comment already says it).

- 11-05 18:54Z fixer: run 42071969500 finished except the Falcor gate. **The only real red is test-compile-regression.** check-ci fails solely on it. Builds and tests on all platforms (GPU/RHI/sm80/CPU), MaterialX, falcor-perf and sanitizer pass. The other required checks pass (check-formatting; SlangPy Tests run 42072027299). Head is still 7ec530a47; the fixer is holding.

- 🔚 **11-05 21:06:34Z tangent-vector CLOSED #14115 (not merged) and turned auto-merge off:** "Closing this PR so we can implement a more backwards-compatible option." (#issuecomment-6669558625). #14099 is still OPEN, assignees tangent-vector (self-assigned 11-02 18:02Z) and pdeayton-nv. The fixer cleaned up its worktrees and sentinel; branch fix/issue-14099 (7ec530a47) stays on origin. **Approach A still exists, unpushed:** `wip/14099-approach-a` (a5a95d7be) in the fixer's shared clone, plan `reports/slang-14099-approach-a.md`. It keeps the FXC leak, a later same-scope declaration replaces a loop variable, two vars from one `for` give E30200, and a loop var replacing a plain declaration gives warning E30205.
  - My decision (21:1xZ): the maintainer self-assigned, and "we can implement" may mean they write it, so **stand down**: no new PR, no push of the wip branch. I asked the fixer for ONE short no-ping comment on #14099 as the resumable artifact, describing approach A and offering it as a draft PR on request. The operator's ping question (msg 229) is moot. Re-check task repurposed for a maintainer reply.
  - 11-05 21:15Z the fixer posted the stand-down comment #issuecomment-6669743401 (4 lines, no ping, OUTPUT_REVIEW approved). It offers approach A as a draft PR and notes that the latest A revision needs a rebase plus a final test run. Nothing pushed. **Chain rests on tangent-vector / pdeayton-nv.**

## Root cause and direction

- Not a regression: fails back to v2025.18.2; the for-scope leak dates to 2017 commit a40b66799.
  Reproduces on 2026.20-97; HLSL-only (`.slang` compiles, DXC 1.9 accepts).
- Root (triager's, matched by the fix): `ParseForStatement` (slang-parser.cpp:7801) builds an
  `UnscopedForStmt`; `checkRedeclaration` (slang-check-decl.cpp:14837) → E30200; `visitBlockStmt`
  (slang-check-stmt.cpp:128-145) hides only direct-child DeclStmts → E39999. Silent miscompile:
  `int i = 7; { value = i; for (int i…) {} }` binds the not-yet-declared inner `i`. Related #13752.
- Approaches: A (non-breaking, newest for-init redecl wins), B (DXC scoping, breaking), C (per-loop
  scope + lookup fallback). Dispatched A 10-30 20:14Z.
- **10-30 22:48:21Z tangent-vector (MEMBER) directed B:** "let's just fix this and implement the proper
  scoping all developers writing code these days expect … technically a breaking change … If the
  authors of FXC already moved on, I think we can too."
  https://github.com/shader-slang/slang/issues/14099#issuecomment-6535132734 — no bot mention, so no
  post-back authorization. Relayed verbatim 22:49Z (msg 31); the fixer stood A down before any PR.
- PR commits: failing repro test, parser fix (every `for` gets one scope shape), droppable commit
  removing dead `UnscopedForStmt` + module version 37→38. Full suite 11337/11340 (3 fp8 CUDA fail
  on master too). Reviewer N5: 8 other open PRs also bump to 38 (#14114 #14051 #13992 #13953 #13872
  #13792 #13564 #13425) and #13885 sets 39 — whichever lands second bumps by hand.

## Lessons

- `send_message` to a peer thread with unanswered inbound rows is refused without
  `in_reply_to=<seq>`; pass the latest peer row.
- A `workflow_dispatch` ci.yml run on a bot draft is throttled behind human PRs; "waiting on the
  Falcor gate" is a misreading. Do not re-dispatch — un-draft. A fixer cannot `gh pr ready`.
- Side finds go to the owning triager session to verify + dup-search + file; that session owns the
  new issue, so record ownership here before its webhook arrives.
- 🔚 **11-05 ~21:2xZ: terminal for the bot — maintainer PR #14360.** tangent-vector opened #14360 "Fix HLSL loop variable declaration order" at 21:04:42Z (branch `codex/fix-hlsl-loop-declaration-order`, head 0e5adf3c2c, `pr: breaking change`, "Fixes #14099. Supersedes #14115"). It keeps HLSL loop vars in the containing scope (post-loop reads still work) and lets a later loop initializer shadow an earlier same-scope local through a synthesized `HLSLForLoopInitializerAttribute`; a plain `int i` after a loop is still an error. It also makes unbraced HLSL control-flow bodies implicit scoped `BlockStmt`s, which **overlaps #14118 / our parked draft #14119 for HLSL** (no action; #14119 stays parked on #12266). Module version 38→39 (as did #14115 and #14344). The first event was a `pr_ready_for_review` webhook; slang-pr-approver is paused, so I did not forward it and queued it in `data/approver-pause-queue.md`. I cancelled re-check `recheck-14115-compile-re-2155`, because its case (b), a maintainer PR, is met. I sent nothing to the fixer: approach A is superseded, and branch `wip/14099-approach-a` stays unpushed. The bot does not act on #14360 unless asked.
