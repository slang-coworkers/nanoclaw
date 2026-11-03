---
type: chain
description: "Human-filed (pdeayton-nv, MEMBER, bot-ok) HLSL bug 10-30: sibling `for (int i…)` loops give E39999+E30200 under -lang hlsl, plus a silent miscompile. Long-standing FXC-style UnscopedForStmt leak. tangent-vector directed approach B (DXC scoping, breaking) → draft PR #14115, R1 APPROVE_WITH_NITS; 11-02 tangent-vector CHANGES_REQUESTED (comment quality, \"should probably be ready to go\") addressed in 4b3a2c467; PARKED on the operator un-draft (dashboard msg 191). Spawned #14118 and #14120."
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
| PR | **#14115** "Scope HLSL for-loop variables to the loop", DRAFT, branch `fix/issue-14099`, `pr: breaking change`, head **4b3a2c467** (11-02 comment rewrite; was 42f8ba6d0), pr-mapping → okyiy6 |
| Review | slang-reviewer R1 at ea4cbbfe0: **APPROVE_WITH_NITS 0/0/0** (`raw/combined-review-14115-r1.md`); N1–N5 + C004/FG003 applied in 42f8ba6d0. **11-02 23:18Z tangent-vector CHANGES_REQUESTED**: "Improve the quality of your commenting and this should probably be ready to go." Addressed in 4b3a2c467 (comment-only) |
| CI | none real: dispatch run 41155151526 throttled (`wait-for-human-priority` failed, IS_THROTTLED_BOT, 40 jobs skipped). Un-drafting is the only CI path |
| Parked | **operator: un-draft #14115 and #14119** (dashboard msg 191 supersedes msg 147; I recommend (a) Main runs `gh pr ready`). Timer: re-check #1 `recheck-14115-ready-faff` fired 11-02 17:00Z (unchanged); **re-check #2 `recheck-14115-ready-2-3f50` 2026-11-05 17:00Z is the final one** — if still unchanged it parks all three with no timer (webhook-driven) |
| Human asks | pdeayton-nv: the rewritten #13219 test (`tests/spirv/debug-lexical-scope-unscoped-for.slang`, reads `i` after the loop); a maintainer: keep/drop the module-version 37→38 commit |

## Re-check log

- **11-02 17:00Z (re-check #1): unchanged → case (e).** #14115 draft @ 42f8ba6d0 and #14119 draft @ 787db86d2; 0 reviews,
  only bot/coderabbit/board-sync comments, CI checks skipped (draft). No human comment on #14099/#14118/#14120 since
  tangent-vector 10-30 22:48Z. No operator reply: Main session `sess-1793389632872-0go3tx` (thread 14099) has no inbound after
  row 192 (10-31 04:19Z). Reminder sent to orchestrator-dashboard on the 14099 thread (msg id 31). No coworker nudged.
  The fired task cannot be `ncl tasks update`d ("no live task matched"), so re-check #2 is a new one-shot.

- **11-02 23:17–23:18Z tangent-vector review on #14115 (CHANGES_REQUESTED).** Inline comment on slang-parser.cpp: "Stop adding *process* information (e.g., issue/PR numbers) as documentation in the codebase. Implementation comments should describe the architecture, design, and approach … written in a more "timeless" fashion … The *process* by which we got here … is already going to be recorded in things like the GitHub issue tracker." Review body: "@nv-slang-bot Improve the quality of your commenting and this should probably be ready to go." 23:36Z: the fixer replied inline (discussion_r4448978121, r4449080918) and pushed 4b3a2c467, which rewrites every comment the PR adds. No behaviour change, affected tests 9/9, CODE/OUTPUT_REVIEW approved, no CI re-dispatch, no reviewers requested. The fixer saved the shared learning (slang-maintainer-rule-no-process-information-issue). I asked the fixer to apply the same rule proactively to #14119, whose tests carry "(gh-14118)" and "option B on gh-14118" comments. The un-draft is still with the operator; the maintainer's "should probably be ready to go" strengthens option (a).

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
