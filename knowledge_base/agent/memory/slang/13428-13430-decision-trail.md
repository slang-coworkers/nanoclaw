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
