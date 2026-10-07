---
type: chain
title: slang#13428 — local multi-declarator `int j = …, k = j < 2;` → E30015
description: Triaged + reproduced regression (2025.4 OK → 2025.5+ fail), parser declarator registration. GO on Approach A through the triager 2026-10-04; draft PR #13432; sibling #13430 released to fixer
---

# slang#13428 (external reporter andy-slater, 2026-10-04)

**Triage (slang-triager, comment 5984460232, master `6ba151dcf`):** `ParseDeclaratorDecl` (slang-parser.cpp ~:3857-3901)
adds a declarator group's VarDecls to the scope only in `CompleteDecl` (~:5865/:5897), after the whole statement.
So `tryParseGenericApp` → `CheckTerm(j)` in a later initializer can't see `j`, and E30015 sticks. A shadowing
variant (`typedef int T;` + `int T = …, m = (T) - 1;`) resolves to the global (E30060). Regression window
2025.4 → 2025.5 (#6281 two-stage parsing is in it; not commit-bisected). I verified on GitHub 10-04: bot author,
2901 chars, labels `regression`+`reproduced`, Type Bug, no assignee.

## Decision (mine)
- 10-04 ~21:20Z: **GO on Approach A, through the triager** (precedent #13423/#13409: external reporter, no assignee).
  Separate draft PR `fix/issue-13428`, not bundled with #13426 (no PR for #13426 yet; same file, different spots;
  whichever lands second rebases). Conditions: the prototype's Body-stage-only gate and the CompleteDecl skip guard
  are both flagged shapes. The fixer justifies both in the process report, or switches to B (per-declarator CompleteDecl)
  if the guard turns out to mask. (Condition 1's bootstrap premise was corrected 10-04 21:42Z, see below.)
- Sibling ICE (local struct field init `int b = a < 2;` → E99997 "decl has no parent", 2026.2 OK → 2026.5.2 fail):
  **YES to the triager filing it** after a dedup check (filing a verified issue isn't operator-gated).

- 10-04 21:28Z: triager released the fixer (wt-slang-13428, `fix/issue-13428`, no PR yet) with all conditions.
  Sibling **filed as #13430**. I verified it live: bot author, Type Bug, `regression`+`reproduced`, 3183 chars, no assignee.
  Comment 5984460232 was edited with a #13430 follow-up line and is still the only comment. #13430's root: the parser's lookup
  (CheckTerm / peekTypeName `(a)`) enters local struct L → `ensureDecl(L)` → `checkForRedeclaration` aborts because
  `L->parentDecl` is null until CompleteDecl. Corrected window: 2025.4 OK, 2025.5–2025.12 segfault, 2025.17+ abort. That's the
  same v2025.4→v2025.5 window as #13428. The #13428 fix doesn't cover it.
- 10-04 ~21:30Z: **GO on #13430 too, through the triager, sequenced after #13428's draft PR.** Same fixer, separate PR
  `fix/issue-13430`, canonical thread `gh-issue-shader-slang/slang-13430`. Both share a root ("registration deferred
  to CompleteDecl"), so the fixer has to say in #13428's process report whether one producer-side fix covers both.

- 10-04 21:42Z: **triager correction, accepted.** The core-module bootstrap break was never caused by the missing
  Body-stage gate. The cause was a generic `parentDecl != containerDecl` skip in CompleteDecl: ParseEnum sets parent
  before membership (`pushScopeAndSetParent`), so the magic enums (AddressSpace/AccessQualifier) never register and
  getPtrType hits InternalError. Ungated + VarDecl-only skip: bootstrap OK and the repros are fixed. I verified 5984460232 was edited (3319 chars,
  still the only comment, the pitfall is now worded correctly). ⇒ The Body-stage gate is dropped unless the fixer finds a real
  reason. The skip has to identify the early-registered decls explicitly; parentDecl equality is not proof of membership.

- 10-04 22:32Z: **shared-root answer is NO** (the fixer's probe on master). Setting the struct's parent before
  `parseDeclBody` fixes #13430 but leaves #13428 at E30015. A comma group inside a local struct needs both fixes. These are
  two missing properties on two producers, struct parent link and VarDecl membership + ReadyForParserLookup, so there's no widening.
  **The fixer took B** (full CompleteDecl per declarator, no skip, no Body gate). The argument against A: a later
  initializer checks the earlier declarator before its modifiers are attached. Bisect candidate `7911c9437`, in progress.
  #13430's fix is now concrete: set L's parent before its body is parsed, as ParseEnum's `pushScopeAndSetParent` does.

- 10-05 01:46Z: **fixer status (msg 453534).** B implemented (CompleteDecl per declarator, one SharedModifiers per group,
  no Body gate, no skip guard). PLAN_REVIEW approved, new tests pass, full suite = same 61 env failures as master.
  Bisect **confirmed 7911c94373 (#6281)**. /code-review cascade: `visitBlockStmt` (slang-check-stmt.cpp:119-122) hides
  only `as<Decl>(declStmt->decl)`. `DeclGroup` is a `DeclBase`, not a `Decl`, so group members are never hidden
  (I verified the code shape on `6ba151dcf`). The fixer reports that `int y = j; int j = 1, k = j < 2;` turns into invalid
  HLSL with B, and that `…, k = 2;` already miscompiles on master. That's their measurement; I haven't rerun it.
  **My scope ruling: YES, same PR.** It's a separate commit with its own test, hiding and unhiding each group member the way
  `ensureDeclBase` already iterates `DeclGroup::decls`. The process report has to describe it as a cascade, and the PR body
  has to say it also fixes the pre-existing master miscompile. No separate issue. ETA for the draft PR was ~1.5h (~03:15Z).

- 10-05 01:49Z: **the triager approved a scope addition, and I accept it.** `visitBlockStmt`/`visitDeclStmt`
  (slang-check-stmt.cpp ~:71-123) hide/unhide only single-`Decl` DeclStmts, so declarator-group members are visible before their
  declaration point. It goes in as a separate commit in the same PR, because B alone would turn `int y = j; int j = 1, k = j < 2;` into a
  silent miscompile. **I verified on master 6ba151dcfc (Release slangc, HLSL):** `static int j = 5;` + `int y = j; int j = 1, k = 2;`
  emits `int j_0;` (uninit) and reads it. The global `5` is ignored. The test must pin the global-shadow value.

- 10-05 02:18Z: the fixer is ready to open the draft PR from the **new branch `fix/issue-13428-b` @ `3cb6d0c084`** (4 commits by nv-slang-bot, no
  Claude trailer). The old `fix/issue-13428` @ `ae10b8b152` has all 4 commits carrying `Co-Authored-By: Claude`, and the slang CLAUDE.md forbids
  that. **I checked: both heads have the same tree, `6b3bf010be`.** The triager declined the force-push, which was correct. **My call: KEEP
  the stale branch.** Deleting it can't be undone, it's harmless (no PR, no review), and it's not durably authorized, so I didn't
  escalate it either. Because the `-b` suffix may defeat branch-convention routing, `report_pr_created` is required.

## PR #13432 (draft, opened 10-05 ~02:30Z, head `3cb6d0c084`, branch `fix/issue-13428-b`)
I checked it live on 10-05: draft, `pr: non-breaking`, closingIssuesReferences = [13428] only (the triager caught a prose "fixes #13430"
and had it reworded), +231/−37, 4 commits by nv-slang-bot with no Claude trailer, body notes it supersedes `fix/issue-13428`. The pr-mapping row is
there (fixer `sess-1791148592366-vqg8p2`, thread `gh-issue-shader-slang/slang-13428`). Cmt 5984460232 now says "fix in draft PR #13432" plus the bisect
(7911c94373 = #6281). CI run 37254974284 is dispatched, and slang-reviewer has been asked to review.
- #13430 was released to slang-fixer on `gh-issue-shader-slang/slang-13430` (separate PR `fix/issue-13430`, producer-side fix).
- Re-chase `rechase-13432-13430-e21b` (2026-10-06 03:00Z). The ready-flip is operator-gated and gets asked only after the reviewer and CI are green.

## #13430 fix-layer decision (10-05 ~03:20Z, mine)
- **B, overriding my own "fix where L's parent gets set."** That direction was a hypothesis; A leaves generic `L<T>`, `L::a < 2` and
  `struct L : B0` broken. B: `parseDeclBody` drops `parser->semanticsVisitor` for its duration, so a local struct body parses
  like a global one, as docs/design/parsing.md (two-stage section, "decl-level expressions … parsed in the first stage") prescribes. **I verified
  on master 6ba151dcfc:** the doc text; method bodies are always `UnparsedStmt` (parseOptBody); the global controls generic, `L::a` and base all compile,
  while the local basic one gives E99997. Conditions: RAII restore (abort is an exception), a local-struct `f<2>()` member-init row pinning the heuristic, and a parsing.md sentence.
- Shape (a), the interface `static const … b = a < 2`: **my "could not reproduce" was WRONG.** My probe printed only the first error line
  and never checked the exit code. E30623 prints first, and then Release **segfaults (rc 139)**. I re-ran it 10-05 ~03:20Z on Release 6ba151dcfc: rc 139,
  E30623 ×2; the control (`a` only) gives rc 255. Origin: #11706 (cde7d65f80), whose `SLANG_ASSERT(witness)` at check-expr.cpp:2840 compiles away in Release
  → null `getSub()`. **Filed as #13433** (10-05 03:23Z; I verified it live: bot author, Type Bug, bug+regression+reproduced, 3159 chars, 0 comments, links #11706, no @-mentions). Unrouted; it re-opens on a human comment. ⇒ A diagnostic-shaped repro has to check the rc;
  a crash after the correct diagnostic looks clean in grep output.
- Shape (b), `struct S{…} s0 = { S::N < 2 };` local → E30015 (global OK, `>` OK, verified): fold it into #13432 as a separate commit if it stays inside
  ParseDeclaratorDecl's type-spec registration; otherwise file a follow-up.

## PR #13434 (#13430's fix; draft, opened 10-05 ~03:45Z, head `a01886a4d0`, branch `fix/issue-13430`)
I checked it live: draft, `pr: non-breaking`, closes [13430] only, 3 files (parsing.md, slang-parser.cpp, tests/language-feature/local-struct-member-initializer.slang)
+128/−2, 3 commits by nv-slang-bot with no Claude trailer. Issue cmt 5987786666 (bot) links it. **The pr-mapping points at fixer session `vqg8p2` on the 13428 thread**
(there's no fixer session on the 13430 thread), so the triager pinned the #13430 work into the existing fixer session. PR events land there; that's the right owner.
The `S::N < 2` (b) commit stays on the #13432 side and waits for slang-reviewer's #13432 verdict.

- 10-05 06:17Z: **[Triage Resolution] for #13430.** I checked it live: #13434 head `457ae39a0e`, 4 files +198/−2, 4 bot commits with no trailer, closes [13430], no GitHub reviews.
  slang-reviewer (internal) gave APPROVE_WITH_NITS with 0 bugs, and its test gaps were filled. CI run 37270839605 (workflow_dispatch) is still **waiting**, not green, so there's no ready-flip ask yet.
  #13432 is now at head `b62ea3d0c2` (6 commits, the (b) `S::N < 2` commit included). CI 37254974284 (old head) was cancelled. At b62ea3d the dispatch run **37266152571 is `waiting`** behind wait-for-human-priority + falcor gate (I verified this; the PR-event run was skipped as a draft). The [Fix Report] waits on slang-reviewer's delta verdict.
- Reviewer side-find: a local struct `static const int N = x + 1;` where `x` is a function local. **I reproduced it on Release 6ba151dcfc:** rc 0, only warning E41016,
  and the HLSL emits `int x_0;` then `buf[1] = x_0 + 1`. The `x = buf[0]` initialization is lost, so this is a silent miscompile. Dedup searches found nothing. **Filed as #13435** (10-05 06:21Z; I checked it live: bot author, Type Bug, `reproduced`, 2819 chars, 0 comments, links #13434). Not a known regression (2025.12–2026.19 emit the same output; 2025.1 gives E30015). Unrouted: diagnostic vs capture is the maintainer's call.
- 10-05 06:23Z: #13435's `issue_opened` webhook was the bot's own filing echoing back. I checked it live: open, 0 comments, body matches the payload. It's owned, so no dispatch went out. Its gap was a missing resume path, so I armed `i13435-maintainer-gate-c5d3` (12h; `gates/i13435-maintainer-gate.sh`, which fires on CLOSED or a non-bot comment). The same script with `GATE_ISSUE=13433` backs `i13433-maintainer-gate-6a3c`. I proved it on controls: 13435/13433/13430/13428 → false (bot-only comments), 12457 → CLOSED, 13350/13300 → HUMAN_REPLY, bad number → PROBE_FAILED.

- 10-05 14:18Z: **[Triage Resolution] for #13428.** I verified it live: #13432 is a draft at head `11711dc20a`, 5 files +276/−50, 7 commits by nv-slang-bot with no trailer, closes [13428], 0 GitHub
  reviews, bot-only comments. The stale branch is still `ae10b8b152`. slang-reviewer R2 gave APPROVE_WITH_NITS with 0 bugs, but **coverage was partial** (A exited 3×, Devin timed out, C finished). The nit was a comment-only fix.
  CI has not run anywhere: 37266152571 (b62ea3d) and 37270839605 (#13434, 457ae39) are both `waiting` at wait-for-human-priority, and PR-event run 37322663242 (11711dc) was skipped as a draft.
  ⇒ My "ask once reviewer+CI are green" condition **can't be met while the PR is a draft**, because the draft state is what skips CI. So I posted the un-draft decision for **both** PRs to
  orchestrator-dashboard at 10-05 ~14:25Z. The triager chain is closed until merge.

- 10-06 03:00Z re-chase: **nothing changed and the operator hasn't answered** (dashboard rows since 14:20Z show no reply). Both PRs are still drafts at `11711dc20a` / `457ae39a0e`, with 0 GitHub reviews and bot-only comments. skiminki-nv is assigned and review-requested on both. The one new human action: jhelferty-nv put #13428 on milestone Q4 2026 (Fall) at 10-05 17:25Z, with no comment. I checked the dispatch runs' jobs: `wait-for-human-priority` **failed** ("Stop yielded bot CI") and the falcor gate is waiting. No build or test job ran. The 2nd un-draft ask went to the dashboard (thread …-13428). Re-armed as `rechase-13432-13434-undr-e1b5` (10-07 03:00Z).

**Resume on:** the fixer's draft PR / [Fix Report] via the triager, or a human comment on #13428.
