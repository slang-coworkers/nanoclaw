---
type: project
name: project_13876_non_overloadable_same_scope_redeclaration
description: "slang#13876 (skiminki-nv, MEMBER, 10-22 18:22Z, self-assigned, sub-issue of umbrella #13719): no redeclaration diagnostic when a global `static const` collides with an [UnscopedEnum] case, a cbuffer member or a tbuffer member; order-dependent (static const after the enum does error). Bug-report shape, so ROUTED to slang-triager like siblings #13720/#13750/#13752. 18:25Z the assignee asked @nv-slang-bot to reproduce and propose a PR, so the fix is authorized; 18:37Z triaged (two root causes; A+B fix), handed to slang-fixer sess-1792694206953-sgt9at; 10-23 00:17Z resolution: draft PR #13880 @776bfc5d9 (12 files, R1+R2 applied, pr: breaking change). PARKED on assignee 2-part question (cbuffer/tbuffer gating; enum Mode{Mode} exemption) + review; OPERATOR decision pending on 3 found pre-existing bugs; one-shot rechase-13876-pr-13880-c876 10-29 12:00Z."
---

# slang#13876 — diagnose non-overloadable declarations in the same scope

**10-22 18:22Z, `issue_opened`.** Live read at routing time: OPEN, 0 comments, no labels,
created == updated, body = payload. Author **skiminki-nv** (MEMBER), self-assigned, timeline is
`assigned` + `issue_type_added` + `parent_issue_added` (parent = umbrella #13719,
[[project_13719_unqualified_name_lookup_umbrella]]). Only my webhook session
`sess-1792693340132-gh8h38` is on `gh-issue-shader-slang/slang-13876`; no task; `conversations/`
hits were substring false positives. R6 gate nanoclaw#1993 still a draft, so routing unchanged.

**Why routed, not held (rung 4 of [[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]]).**
Self-assignment alone does not make it a maintainer-owned plan. The body is a bug report
(reproducer / expected / actual), with no fix direction, "Done when" or own PR. Same author's
bug-report sub-issues of #13719 — #13720, #13750, #13752 — were all triaged by the bot, and the
assignee engaged and gave direction (#13750 C++ semantics 10-21; #13752 shadowing rules 10-22,
part 1 already at the fixer). Held were only the umbrella itself and the design clean-up #13819
([[project_13819_namespace_container_cleanup]]).

**10-22 18:24Z:** dispatched to `slang-triager` (session `sess-1792693495093-68uevm`) on the canonical thread, triage comment's
Next-action addressed to the assignee.

**10-22 18:25Z, assignee summons.** skiminki-nv commented
[6348134538](https://github.com/shader-slang/slang/issues/13876#issuecomment-6348134538): "@nv-slang-bot
Please reproduce and propose a PR to fix the issue." This is a real mention by the assignee, so the
fix is authorized. I forwarded it verbatim to the running triager session `sess-1792693495093-68uevm`
on the canonical thread, with `<github-post-authorized />`, and asked for triage first and then the
fixer handoff. At that point no bot comment had been posted yet.

**10-22 18:37Z, TRIAGED** (slang-triager; Main checked live: comment
[6348371268](https://github.com/shader-slang/slang/issues/13876#issuecomment-6348371268) posted, label
`reproduced`, Type "Language Maturity" was set by a human). Memo archived at
`/workspace/agent/reports/triage/triage-13876.md`. Reproduced at `e485e7861`. The triager found two root causes:
1. Order dependence: `[UnscopedEnum]` cases become untyped `static const` LetDecls in the enclosing scope
   (`slang-parser.cpp:6123`). An inferred-type var jumps to DefinitionChecked, so `ensureDecl` skips the
   ReadyForReference redeclaration visitor. The check also only looks backwards.
2. cbuffer/tbuffer members live in a synthesized `ParameterGroup_*` struct behind a `__transparent` var
   (`parser.cpp:4402`). `checkForRedeclaration` (`slang-check-decl.cpp:14880`) compares only direct members of
   the same container.
Recommended fix: A + B (run the skipped visitor in `ensureDecl`, and compare transparent buffer members across
the enclosing scope). Scope: all three cases as E30200 in every language version. **One question is open to
@skiminki-nv:** should the cbuffer/tbuffer cases be version-gated (warning in 2018–2026, error in 202c)? The fixer
keeps the severity at one call site and does not decide it. Handed to slang-fixer session
`sess-1792694206953-sgt9at` on the canonical thread. Next: a draft PR from the fixer.

**10-22 21:06Z, DRAFT PR [#13880](https://github.com/shader-slang/slang/pull/13880)** (Main checked live:
`fix/issue-13876` @ `ce9d91323`, draft, `pr: breaking change`, 8 files +555/−1, mapped to fixer
`sess-1792694206953-sgt9at`; the issue delta comment is
[6351304001](https://github.com/shader-slang/slang/issues/13876#issuecomment-6351304001)). E30200 now fires for
all three cases in both orders. It also covers untyped let/var, unsized arrays, `-unscoped-enum`, and GLSL
blocks without an instance name. The fixer says full slang-test gave 11142/11145, with 3 fp8 CUDA failures that
also fail on master. ⚠️ The triager reported "0 CI failures", but the badge is RED: `check-ci` +
`wait-for-human-priority` fail. That is the documented benign bot priority-yield. 92 jobs were skipped and the
falcor gate is waiting on a human, so there is no full-CI signal yet.
**PARKED on** skiminki-nv's gating answer (issue comment 6348371268) plus a maintainer review. One-shot
`rechase-13876-pr-13880-c876` on 10-29 12:00Z. Still pending: the fixer's [Fix Report] and the triager's [Triage Resolution].
21:08Z: the triager corrected its record. Its "0 failures" came from `gh pr checks`, which did not list the two
failing priority-yield runs. Read CI from `repos/<o>/<r>/commits/<sha>/check-runs` instead (the triager shared this
as a learning). Neither bot issue comment made a CI claim, so nothing on GitHub needed correcting.

**10-23 00:17Z, TRIAGE RESOLUTION** (slang-triager; Main checked live). Draft #13880 at `776bfc5d9`, 12 files
+799/−2, 14 commits, `pr: breaking change`. Peer review R1 and R2 were both REQUEST_CHANGES, and all findings
were applied; the fixer stopped at the two-round cap. The fixer reports slang-test 11145/11148 locally (the 3
fp8-cuda failures also fail on master) and slang-static-unit-test 61/0. CI is still red from the priority-yield:
2 failing, 92 skipped, falcor gate waiting. No human comment or review yet.
The merge-blocking question to skiminki-nv now has **two parts**, in PR explanation comment
[6351291733](https://github.com/shader-slang/slang/pull/13880#issuecomment-6351291733) and repeated in issue
status 6351304001:
(1) should cbuffer/tbuffer conflicts be a warning in 2018–2026 and an error in 202c, or an error everywhere?
(2) under `-unscoped-enum`, should `enum Mode { Mode }`, which compiled before, be exempt?
**OPERATOR DECISION PENDING** on 3 pre-existing bugs the fixer found and did not file:
- `-no-mangle` with `cbuffer CB { float CB; }` segfaults;
- a Debug `foundParent` assert fires on a `__generic` cbuffer;
- `[[vk::push_constant]] static let` gets no E31219.
`rechase-13876-pr-13880-c876` (10-29 12:00Z) has been updated with the new head, both questions, and a step to re-ask
the operator.
