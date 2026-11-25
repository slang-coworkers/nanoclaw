---
type: project
name: project_13985_uint64_loop_trip_count_signed
description: "slang#13985 (nv-slang-bot, filed 10-28 18:33Z by slang-triager from the #13978/#13984 fixer side finding): for-loop trip-count inference in slang-check-stmt.cpp compares uint64 bounds as signed, so a bound above INT64_MAX gives a false E30514 'loop runs zero times' and the loop is deleted. Own fix chain; slang-fixer session 80nd8r on gh-issue-shader-slang/slang-13985 since 18:35Z. Sibling: [#13986](project_13986_int64_min_div_neg1_sigfpe.md) (SIGFPE on INT64_MIN / -1)."
---

# slang#13985: uint64 `for` loop with a bound above INT64_MAX is removed as zero-trip

**Origin.** slang-fixer (session `3s6rec`, #13978 chain, draft PR #13984) reported two side findings
at 18:29Z. The #13973 Main (`sess-1793201570113-2tdabv`) gave the triager (`79rk2o`) a go-ahead at
18:31:17Z: file both, then hand each to slang-fixer as its own chain, keep the PRs independent on
master, and note the overlap with #13975/#13984 in `slang-check-expr.cpp`. The second finding became
#13986.

**Ownership.** The issue_opened webhook landed 18:33Z in Main `sess-1793212431815-3vzkl5`. That Main
ran the bot-filed-owner ladder and found the owner at rung 7 (the triager's and #13973 Main's newest
rows). It dispatched nothing. The triager sent `[Triage handoff]` at 18:35:51Z, and **slang-fixer
session `sess-1793212552468-80nd8r`** is on the canonical thread (checked 18:36:28Z).

**Resume on:** fixer [Fix Report] via the triager → the #13973 Main's chain.

**2026-11-16 19:05Z — maintainer self-claim.** skiminki-nv self-assigned the issue
(19:05:57Z; prior assignee jkwak-work from 10-28 no longer listed) and commented: "Assigning to
myself. This should be fixed as a byproduct of overhauling the AST-level constant folding, which
I'm currently working on." The comment arrived as a `pr_mention` webhook but the live body has **no
@nv-slang-bot mention** (checked) — so no post authorization and no dispatch (owner chain already
existed). Main `3vzkl5` relayed it verbatim to fixer `80nd8r` (pin + thread + `in_reply_to`; delivery
verified seq 36, 19:09Z) with PR #13993 state (OPEN, awaiting_human; CI run 40780863789 is the 10-28 priority-yield run in
`waiting`, not in flight). Fixer acked 19:09Z (thread-only, no GitHub post): skiminki-nv is taking the
root cause himself (his constant-folding overhaul = #13954, one of #13993's two merge prerequisites
alongside #13984/SCCP). **HOLD:** #13993 stays open as draft, untouched (no pushes/review rounds/CI
pokes); the fixer reassesses if he comments on #13993 or the overhaul PR lands.

**2026-11-19 16:48Z — maintainer will rewrite the fix himself.** skiminki-nv commented again: he
originally planned to fold this into #14509 ("Overhaul integer constant folding in the front-end",
his, OPEN/unmerged, branch slang-int-folding) but will now do a separate PR, and "While slang-bot
already wrote a PR to address this, I think I'm going to rewrite it after #14509 has landed" — for
type-aware inference incl. iterator wraparounds (ref: slang-check-stmt.cpp#L806 @ 68cd6ed). No bot
@mention in the live body → no post auth. Main `3vzkl5` relayed verbatim to fixer `80nd8r` (pin +
thread + `in_reply_to`; delivery verified seq 38, 16:49Z) noting the tentative phrasing and the
in-surface option to close #13993 as superseded — fixer's call. PR #13993 still OPEN draft at relay
time. Supersedes the 11-16 HOLD assumption; awaiting the fixer's ack and disposition.

**TERMINAL 2026-11-19 16:51:59Z — chain closed, maintainer owns the issue.** Fixer `80nd8r`
executed the disposition: draft PR #13993 CLOSED as superseded (verified by read-back: state
closed, 16:51:59Z) with a supersede-pointer comment (id 7015852732, nv-slang-bot, verified) naming
his plan and preserving references (diagnostic test `tests/diagnostics/for-loop-unsigned-trip-count.slang`,
runtime repro, analysis comment); branch `fix/issue-13985` kept on origin; worktree + sentinel
removed. Issue #13985 stays OPEN and his — no post (no @mention auth). Closing is reversible if his
tentative rewrite never lands. Fixer memory: its `fix-13985.md` + log shards hold the terminal state;
prior review rounds stand (R2 APPROVE_WITH_NITS @9b5f00221, nits applied at head 963a7b086).
**Chain complete — no further bot action; resume only if the maintainer asks for our test material
or his rewrite stalls.**

**2026-11-24 14:07Z — maintainer's refined diagnosis (no action taken).** skiminki-nv comment
[7133872094](https://github.com/shader-slang/slang/issues/13985#issuecomment-7133872094) on the
terminal chain: two separate problems — (1) AST-level loop-count inference misreads
`0xFFFFFFFFFFFFFFFFull` as −1 → the zero-trip **warning only** ("this does not remove the loop");
(2) the loop **deletion** is the IR-level issue **#13978** (SCCP plausibly folds
`i < 0xFFFFFFFFFFFFFFFFull` to `0 < -1`). No bot mention (checked live) → no reply, no dispatch.
Recorded for the #13978/#13984 parked chain in
[project_13973_builtin_call_constant_fold_history] — terminal-his state unchanged.
