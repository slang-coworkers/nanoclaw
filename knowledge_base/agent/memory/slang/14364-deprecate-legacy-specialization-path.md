---
type: project
title: "slang#14364 — deprecate and remove the legacy specialization path (compiler + slang-rhi)"
description: "Maintainer (tangent-vector) design/coordination issue, 11-05 22:29Z, self-assigned 11 s later. Asks nothing of the bot -> HELD under rung 4: no dispatch, no post."
---

# slang#14364 — deprecate legacy specialization (global `type_param`, existential-slot specialization)

**11-05 22:29:03Z, `issue_opened`.** Live read 11-05: OPEN, author **tangent-vector**, who
**self-assigned at 22:29:14Z** (events API; actor = assignee). 0 comments, no labels. It mentions
csyonghe and skallweitNV (slang-rhi). The body has no @nv-slang-bot mention.

The body proposes removing two legacy features: global-scope generic type parameters
(`type_param T : IFoo;`, superseded by link-time `extern struct`) and static specialization of
existential "slots", including the "pending layout" for types that do not fit the any-value box.
Plan: confirm no production users, then remove the language support, examples, docs and tests,
drop the slang-rhi support code, and deprecate the API surface (pending layout). The body
rejects a formal deprecation period.

**Disposition: held, nothing dispatched or posted.** Same class as
[#13968](../imported/project_13968_data_driven_modifiers_design_discussion.md): a maintainer-owned
design item with no bug-report shape and no ask of the bot (rung 4).

**Resume** only on a comment that @-mentions @nv-slang-bot, or on an operator ask. Mentions arrive
as webhooks, so no re-chase timer. A later removal PR would also touch slang-rhi (cross-repo).
