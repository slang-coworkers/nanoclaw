---
type: project
name: project_13730_entrypoint_calls_entrypoint_global_in_segfault
description: "slang#13730 (bot-filed 10-17 06:52Z, side bug of #13687 by slang-triager): an entry point calling an entry point that reads a module-scope `in` segfaults (Release) / asserts at specialize-function-call.cpp:246 (Debug). NO fixer; held behind draft #13726. Folded into chase-13726-ready-7233 (10-17 15:45Z) as a third operator question."
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
