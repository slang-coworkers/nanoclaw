---
type: project
title: "slang#14429 — reflection API: query generic parameters and their constraints"
description: "HELD (rung 4) 11-09: maintainer feature request (tangent-vector, MEMBER), assigned to the author by jhelferty-nv 11 s after filing. Second of a 2-issue batch with #14428. No dispatch, no bot post."
---

**2026-11-09 23:47:42Z, `issue_opened`.** Live read at routing time: OPEN, 0 comments, no labels.
Assignee tangent-vector (the author), assigned 23:47:53Z by **jhelferty-nv** (`.assigner`); the
events list has only that event. `grep -rl 14429 memory/` had no hits. The only session on
`gh-issue-shader-slang/slang-14429` is this Main webhook session (`8l1n0e`); no task.

**Batch.** tangent-vector filed #14428 ("importing a module with visibility into its internal
declarations") 14 min earlier, also assigned to the author by jhelferty-nv (23:33:36Z). That
issue has its own Main session (`oxs7bu`). It gets the same disposition.

**What it asks.** If Slang 2026 breaks the `dyn IFoo` parameter idiom that SlangPy recommends,
users rewrite `doStuff(dyn IFoo foo)` as `doStuff<T>(T foo) where T : IFoo`. SlangPy then needs
reflection to:
- wrap a *DeclRef* to a generic function, not only a `Decl*`, because `MyType<float>.doStuff`
  must keep its outer specialization;
- enumerate value parameters of an unspecialized generic and identify which generic parameter a
  parameter type refers to (for example `vector<T,N>`);
- query the constraints on a generic parameter, possibly including constraints on associated
  types.

It is unclear which of these already work for `Decl*` and which do not work for `DeclRef`.
Neighbours: #14423 (variadic type-pack reflection, also held under rung 4) and #4786
(generic-container reflection). On slangpy, tangent-vector's own #1249 (10-29) is "Accept
existential-box names in reflection test".

**Why held.** Rung 4 of
[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new](../imported/feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new.md):
a maintainer item that a peer maintainer assigned to its author. It has its own preferred
solution and no ask of the bot. Same shape as #14423, #14364 and #13882.

**Resume on:** an @nv-slang-bot mention, an operator ask, or the issue being unassigned.
