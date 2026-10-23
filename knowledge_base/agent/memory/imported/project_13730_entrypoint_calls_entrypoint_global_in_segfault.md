---
type: project
name: project_13730_entrypoint_calls_entrypoint_global_in_segfault
description: "slang#13730 (bot-filed 10-17 06:52Z, side bug of #13687 by slang-triager): an entry point calling an entry point that reads a module-scope `in` segfaults (Release) / asserts at specialize-function-call.cpp:246 (Debug). Maintainer-owned since 10-19 (jhelferty-nv assigned; suspects in-place entry-point rewrite instead of clone+rewrite). NO fixer. Their \"existing issue?\" question went to slang-triager with post authorization."
metadata:
  node_type: memory
  type: project
---

# slang#13730 — entry point calling an entry point with a global `in` segfaults

**Origin.** slang-triager filed it at 06:52Z while closing out #13687 (its `[Triage Resolution]`, 06:54Z,
said "neither issue is routed to a fixer; that's your call"). The #13687 Main's 06:55Z close-out left
routing to this issue's own webhook Main session (`sess-1792219975704-699m8n`). Sibling #13729 got the
same treatment from its own session.

**Facts.** Labels `reproduced` + Type=Bug, 0 comments, no assignee. I reproduced on master `d9ede2dd58`
Release (rc=139). Pre-existing (also 2026.13.1), still present at #13726 head `ec1f0a4`. The triager's
untraced hypothesis: `fixEntryPointCallsites` clones the callee with the param `translateGlobalVaryingVar`
added, the call keeps 0 args, and the arity check at `slang-ir-fix-entrypoint-callsite.cpp:96` returns
silently. Related, not a duplicate: #12392 / stale draft #12721 (no global `in` needed, earlier pass).

**Disposition: held, no fixer.** Draft #13726 rewrites how every entry point that reaches a global gets
its param, which is the shape this fix passes through; a fixer on master now would collide with it.
Posted nothing on GitHub (the bot body is the resumable artifact).

**Resume path.** `chase-13726-ready-7233` (once, 2026-10-17 15:45Z) asks the operator three questions:
un-draft #13726, then "#13729 fixer?", then "#13730 fixer?" (now / after #13726 merges / hold). A human
comment or assignee on #13730 goes to the operator. Resume early on either.

Related: [[technique_find_the_owner_of_a_bot_filed_issue_before_dispatching]].

**10-19 update — maintainer-owned.** Asks #1–#3 of the #13726 re-check all timed out on every question.
jkwak-work milestoned #13730 (16:55Z), and jhelferty-nv self-assigned it (17:30Z), then commented (17:32Z,
issuecomment-6273255233). Their guess: entry points are rewritten in place instead of cloned and then
rewritten (`in` → `constref` in place). They asked @nv-slang-bot whether an issue for clone+rewrite or a
trampoline entry point already exists, and CC'd tangent-vector. I forwarded the comment verbatim to
slang-triager on `gh-issue-shader-slang/slang-13730` with `<github-post-authorized />`. Search seeds,
none verified: #12392/#12721, #13271, #13284. I removed the #13730 fixer question from
`chase-13726-ready-ask4-33cd` (10-20 17:25Z); that task now only reports #13730's state. No fixer.

**10-19 17:56Z — bot reply posted** (issuecomment-6273714032, checked live). Per the triager: no issue
tracks just the clone/trampoline split. The closest are #8739 (tangent-vector; its preferred fix is the
trampoline; closed 2026-02-04 by #9869 without building it) and #12392 (open, tangent-vector, draft
#12721). The triager's Debug measurement refines the maintainer's guess: the in-place change is not
in→constref but `translateGlobalVaryingVar` adding a param to `inner` without updating its callers. The
entry-point uniform passes also assert at slang-ir.cpp:3168. **Parked on jhelferty-nv:** a new tracking
issue or reopening #8739. Their reply arrives as a webhook. No fixer.

**10-21 17:39Z — handed to tangent-vector.** jhelferty-nv commented only "@tangent-vector to comment on
this." (issuecomment-6322502316). The comment is addressed to tangent-vector, not the bot, so I dispatched
nothing and posted nothing. **Parked on tangent-vector** (jhelferty-nv is still the assignee). Their reply
arrives as a webhook. `chase-13726-ready-ask5-49d0` still only reports #13730's state, which is correct.

**10-21/22 — tangent-vector's design direction.** jkwak-work re-assigned #13730 to tangent-vector and
jkwak-work (10-21 17:41Z). At 10-22 18:16Z tangent-vector commented (issuecomment-6347967562): the bug
comes from combining module-scope varyings with multiple entry points in one translation unit, a mix
inherited from GLSL and HLSL. If tractable, they want it disallowed: the GLSL dialect allows global
varyings but only one entry point; Slang and HLSL allow multiple entry points but no global varyings.
They were unsure this can be enforced, since released compilers already accept the mix. The comment is
not addressed to the bot, so I posted nothing and dispatched nothing. **It cuts against draft #13726**,
which makes exactly that mix work. I added the direction plus a fourth option ("ask on #13726 how this
direction affects it") to `chase-13726-ready-ask7-db33` (10-23 18:05Z). Parked on tangent-vector and
jkwak-work.

**10-23 00:44Z — root-cause proposal #13882.** tangent-vector filed #13882, "Improve the compiler's
representation of entry points" (open, self-assigned). It proposes normalizing two degrees of freedom:
a function that is both an entry point and a callable subroutine, and varyings written either as
parameters or as module-scope globals. They linked it from #13730 (issuecomment-6355053494). The comment
is not addressed to the bot, so nothing was posted or dispatched. I added #13882 to the ask #7 direction note.
