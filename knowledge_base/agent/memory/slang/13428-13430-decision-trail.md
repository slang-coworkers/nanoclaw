---
type: chain
title: slang#13428 / #13430 — triage → fix decision trail (2026-10-04 → 10-08)
description: Condensed decision history for the #13428 parser-registration regression (PR #13432, merged) and its sibling #13430 (draft PR #13434). Covers the Approach A→B change, the triager's bootstrap correction, the DeclGroup hide/unhide scope ruling, the stale-branch call, and the re-chase log. Settled; live state is in [[slang/13428-local-multi-declarator-generic-lookahead.md]].
tags: [slang, parser, regression, history]
---

# #13428 / #13430: decision trail

Split out of [[slang/13428-local-multi-declarator-generic-lookahead.md]] by okf-synthesis on 2026-10-09.

## Triage and the first GO (10-04)

- slang-triager's comment 5984460232 (master `6ba151dcf`) put the cause in `ParseDeclaratorDecl` (slang-parser.cpp
  ~:3857-3901): VarDecls are added to scope only in `CompleteDecl` (~:5865/:5897). A shadowing variant
  (`typedef int T;` + `int T = …, m = (T) - 1;`) resolves to the global (E30060). Labels: `regression`, `reproduced`.
- ~21:20Z **GO on Approach A through the triager** (precedent #13423/#13409: external reporter, no assignee).
  Separate draft PR, not bundled with #13426. Conditions: the Body-stage-only gate and the CompleteDecl skip guard
  were flagged shapes that had to be justified, or else switch to B.
- 21:28Z sibling **filed as #13430** (bot, Bug, `regression`+`reproduced`). Window: 2025.4 OK, 2025.5–2025.12
  segfault, 2025.17+ abort. ~21:30Z GO on #13430 too, sequenced after #13428's draft.
- 21:42Z **triager correction, accepted.** The core-module bootstrap break came from a generic
  `parentDecl != containerDecl` skip, not from the missing Body gate. ParseEnum sets the parent before membership
  (`pushScopeAndSetParent`), so the magic enums (AddressSpace/AccessQualifier) never registered. ⇒ parentDecl
  equality is not proof of membership.
- 22:32Z **shared-root answer: NO.** Setting the struct's parent early fixes #13430 but leaves #13428 at E30015.
  These are two missing properties on two producers. **The fixer took B.** The argument against A: a later
  initializer checks the earlier declarator before its modifiers are attached.

## Implementation and scope (10-05)

- 01:46Z B implemented, and the bisect confirmed `7911c94373` (#6281). /code-review found that `visitBlockStmt`
  (slang-check-stmt.cpp:119-122) hides only `as<Decl>(declStmt->decl)`. `DeclGroup` is a `DeclBase`, so group
  members were never hidden. **My scope ruling: same PR, separate commit + test**, described as a cascade, with
  the PR body noting it fixes the master miscompile too. I reproduced the miscompile myself on master 6ba151dcfc
  (HLSL emits `int j_0;` uninit).
- 02:18Z the fixer opened from new branch `fix/issue-13428-b` @ `3cb6d0c084`. The old branch carried
  `Co-Authored-By: Claude` (forbidden by the slang CLAUDE.md). Same tree; the triager declined a force-push. **My
  call: keep the stale branch** (deleting is irreversible and not durably authorized). The `-b` suffix may defeat
  branch routing, so `report_pr_created` was required.
- ~02:30Z **draft PR #13432** opened (closes [13428] only; the triager had a prose "fixes #13430" reworded).
- ~03:20Z **#13430 fix layer: B, overriding my own "fix where L's parent gets set".** That idea was a hypothesis;
  A leaves generic `L<T>`, `L::a < 2` and `struct L : B0` broken. B drops the semantics visitor during
  `parseDeclBody`, per docs/design/parsing.md. Verified on master: method bodies are always `UnparsedStmt`, and the
  global controls compile.
- Shape (a), an interface `static const … b = a < 2`: Release segfault rc 139 after the correct E30623, from #11706's
  `SLANG_ASSERT(witness)` at check-expr.cpp:2840, which compiles away in Release. **Filed as #13433** (03:23Z).
- Shape (b), local `struct S{…} s0 = { S::N < 2 };` → E30015: folded into #13432 as a separate commit.
- ~03:45Z **draft PR #13434** opened (branch `fix/issue-13430`). Its mapping went to fixer `vqg8p2` on the 13428
  thread, which is the right owner.
- 06:17Z [Triage Resolution] #13430: head `457ae39a0e`, reviewer APPROVE_WITH_NITS with 0 bugs.
- 06:21Z the reviewer's side-find was **filed as #13435** (a silent miscompile, not a known regression: 2025.12–2026.19
  emit the same output). Its `issue_opened` echo was the bot's own filing, so no dispatch. I armed
  `i13435-maintainer-gate-c5d3` (`gates/i13435-maintainer-gate.sh`, fires on CLOSED or a non-bot comment) and proved
  it on controls.
- 14:18Z [Triage Resolution] #13428 at `11711dc20a`: reviewer R2 APPROVE_WITH_NITS with partial coverage (A exited
  3×, Devin timed out, C finished). No CI anywhere (dispatch runs `waiting`, PR-event run skipped as a draft). First
  un-draft ask for both PRs went to the dashboard ~14:25Z.

## Re-chases and close (10-06 → 10-08)

- 10-06 03:00Z: no change and no operator answer. jhelferty-nv put #13428 on milestone Q4 2026, with no comment.
  2nd ask sent.
- 10-07 03:00Z: no change. slang-fixer had shortened both PR bodies on 10-06 for the new PR-description rule. 3rd ask
  sent.
- 10-07 11:24Z **skiminki-nv approved #13432 and marked it ready themself.** The #13432 ask was withdrawn. 13:39Z
  **merged** (`eaf758404f`), CI 37613848068 passed, #13428 TERMINAL.
- 10-08 03:00Z (#13434 only): no change. 4th ask on thread `…-13430`, moving to a 72h cadence.
- 10-08 11:32Z: the dashboard asked again about #13435. jhelferty-nv had assigned jkwak-work (Q4 milestone) on 10-05
  18:03Z, so it has a human owner. No re-triage, gate kept.
- 10-16 13:08Z: on #13435, **skiminki-nv decided** "no capture, diagnose it" (cmt 6216184529) and asked for a draft fix PR. They
  reassigned the issue to themselves. Main released it to slang-triager on the canonical thread, with the comment quoted verbatim.
- 10-16 13:40Z #13435 [Triage]: Approach A, a lookup boundary in `_lookUpInScopes` (slang-lookup.cpp:815). Once lookup leaves a local
  type, it skips the enclosing function's non-static locals and params, which gives a natural E30015. The fix is based on master, not stacked on #13434,
  which only touches `parseDeclBody`. The triager's scope question ("local types" taken literally would break `struct B { A a; }`) is on the
  issue as cmt 6216745273. Until it's answered, the draft blocks only non-static locals and params. Fixer session `kj3jso`, worktree
  `wt-slang-13435`, base ec39d3af67. Resume on the PR-opened webhook or a skiminki-nv reply.
- 10-16 13:43Z skiminki-nv **answered the scope question**. They edited cmt 6216184529 to strike "~~, or local types~~", and cmt 6216834510 says:
  "types should be accessible". The triager's example in 6216745273 (an earlier local type, `A::K`, the struct's own name) **should compile**. `static const`
  locals of the enclosing function weren't addressed explicitly. Main forwarded the answer to slang-triager on the canonical thread.

- 10-16 15:10Z: slang-fixer [Report]. 2 commits on `fix/issue-13435`, with the lookup fix in `_lookUpInScopes`. All 8 negative cases give E30015, and the fixer lists "shadowed global" among the error cases. I questioned it against the triage memo, which said the global would win. **The memo was wrong, and the fixer is right.** I re-checked with g++ and clang: a local-class member naming a shadowed `x` is an error (it does not fall back to the global), and `::x` reaches the global. The triager corrected the memo and the issue, and asked the fixer for positive tests: a non-shadowed global resolves, and `::x` works. The PR will mark shadowed-means-error as an open default. The positive test (6216745273 verbatim, generic T/N, static locals, lambda in main) passes on cpu/vk/cuda. The fixer's container restarted mid-verify, so it is re-running the full suite and the #13434-merged check. No PR yet.
- 10-16 15:13Z: fixer confirmed. In the shadowed case it finds the local, drops it, and stops at that scope with E30015. An unshadowed global and `::x` behave the same as on master; positive tests are being added. #13434's tests plus these give 7/7 on a combined master+#13434+fix build. Next: the draft PR opens.
- 10-16 15:26Z: full suite on the fix branch 10884/10887. The 3 failures are fp8 CUDA coopmat `CUDA_ERROR_INVALID_PTX`, which the fixer says fail the same way on unmodified master 3a93b38989 (env, not this change). Code review → critique → draft PR.
- 10-16 18:01Z: code review found that a function-local `cbuffer` field reached through its transparent local leaked; now blocked. Added tests for `let`, a generic local type, a lambda param, a `newValue`/subscript param, and a lambda in a member that captures its own param/local/`this`. PLAN_REVIEW is approved; the full suite is re-running, then CODE_REVIEW, then the draft PR. That is ~2.75h since the first report with no PR yet, so the fixer is still busy rather than stalled.
- 10-16 18:29Z: **draft PR #13718 opened.** I checked it on GitHub: head `253e8f1eeb`, 3 files +379/−0 (slang-lookup.cpp +106, a diag test with 13 cases, a positive test), `pr: breaking change`, closes [13435], review requested from skiminki-nv. CI: 5 pass, 56 skipped (draft). The pr-mapping points at fixer `kj3jso`. ⚠️ Two bot comments landed on #13435 16 s apart, 6222119482 (triager) and 6222123712 (likely the fixer), and they **disagree**: the first lists 3 defaults to confirm, the second says "confirms the two defaults". I asked the triager to fold them into one. The un-draft decision goes to the operator. One-shot re-check `rechase-13718-undraft-65dd` is set for 10-19 18:30Z.
- 10-16 18:34Z: duplicate 6222123712 deleted (404, checked); 6222119482 is canonical. The fixer now posts status only on #13718, and the three-default framing is consistent everywhere.
- 10-16 18:43Z: fixer report: `[Fix Review Request]` sent to slang-reviewer. The workflow_dispatch CI run 38946702041 covers the draft's CI gap. Next: the reviewer's verdict, then `[Fix Report]`, then `[Triage Resolution]`.
- 10-16 ~18:50Z: I checked the dispatched CI run 38946702041 (workflow_dispatch by the bot). It is the **documented priority-yield**: `wait-for-human-priority` and `check-ci` failed, 26 jobs skipped, 1 success, and `falcor-build-approval-gate` is waiting on `ci-approvers`. **No build or test job ran**, so the draft still has no CI verification. Only the fixer's local suite (10884/10887) verifies it. A red badge here does not mean a code failure. This adds weight to the un-draft decision.
- 10-16 21:14Z: slang-reviewer R1 on #13718 is a **small REQUEST_CHANGES**. It meets every maintainer requirement with 0 regressions. 4 test/accuracy items, each with a tested remedy: an unpinned breadcrumb leg, an unpinned const-local break, the later-declared-local case, and the "did you mean" note. The verdict went to the fixer; next is the R2 push, then a delta re-review.
- 10-16 21:29Z: the fixer applied the 4 R1 items locally as 2 commits (not pushed). (1) The cbuffer row, which already failed on master, is now a lambda shape that reaches the cbuffer field. (2) A const local in a type position gets a row, and the Risk wording is fixed. (3) A local declared after the type is pinned as an error, and the misleading "C++ also rejects" comment is fixed. (4) "Did you mean" no longer suggests hidden locals, via a shared `isAutomaticStorageDecl`. Plus a completion test, which fails on master. Next: suite, critique, push, R2.
- 10-16 21:49Z: R1 remediation pushed. Head 94e02242d9 (+2 commits). Suite 10886/10889, with the same 3 fp8 CUDA failures as before. CI run 38971225993 was dispatched. The R2 `[Fix Review Request]` went to slang-reviewer as the final round.
- 10-17 00:15Z: slang-reviewer R2 on #13718: **APPROVE_WITH_NITS**. A found 0 bugs, 2 gaps, 2 questions; Devin found nothing. All R1 items are verified, and the full suite shows 0 regressions. The 4 diagnostic/IDE-accuracy nits (N1–N3 applied locally, N4 pending) are next, then a quick nit-check. The PR body lists 2 more open maintainer questions: should the `const`/`let` hiding be gated by language version, and should a later-declared local hide a global? Next: the push, then the `[Fix Report]`, then the `[Triage Resolution]`.
- 10-17 01:04Z: **[Fix Report]**. I checked GitHub: draft at head `32e20db8e6`, 6 files +504/−0 (lookup.cpp/.h, check-expr.cpp for "did you mean", plus diagnostic, positive, and completion tests), closes [13435], 0 GitHub reviews, 0 non-bot comments. R2 APPROVE_WITH_NITS, nits applied. Codex CODE_REVIEW must-fix on `static` locals staying visible was deferred to the maintainer. skiminki-nv has 3 questions in PR cmt 6227643175: static locals; const/let (breaking, possibly version-gated); a later-declared local hiding a global (C++ binds the global). That replaces the issue cmt's earlier "shadowed global" framing: an earlier local shadowing a global is an error in both C++ and the PR, so only the later-declared case diverges. CI run 38988116597 yielded the same way (no builds). Re-check `rechase-13718-undraft-65dd` updated, still 10-19 18:30Z.
- 10-19 18:30Z: re-check `rechase-13718-undraft-65dd` fired. #13718 is still a draft at `32e20db8e6`, now **BEHIND** master. 0 reviews, 0 non-bot comments, and no #13435 events since 10-17 01:00Z. Sent a 5-bullet to the dashboard (thread gh-issue-shader-slang/slang-13435) naming both pending decisions. Armed one one-shot `rechase-13718-undraft-r2-2355` for 10-22 18:30Z.
