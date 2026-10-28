---
type: project
name: project_13968_data_driven_modifiers_design_discussion
description: "slang#13968 (tangent-vector, 10-28 00:16Z, assigned to author by jhelferty-nv, no labels): maintainer design discussion on making modifiers (interpolation, layout, address space, string-param attributes) generic/data-driven; floats a parameterized-attribute option and an '@expr' modifier option. Asks nothing of the bot -> held: NO dispatch, NO bot post."
---

# slang#13968 — data-driven / conditional modifiers (design discussion)

**10-28 00:16Z, `issue_opened`.** Live read 10-28: OPEN, author **tangent-vector** (MEMBER),
assigned to the author by **jhelferty-nv** 10 s after filing, 0 comments, no labels, no milestone.
The live body has no @nv-slang-bot mention.

The body asks for discussion, not a fix. Discrete modifier choices (`linear`/`noperspective`/
`nointerpolation`, `row_major`/`column_major`, `std140`/`std430`, address-space keywords, and
string-parameter attributes like `[partitioning("integer")]`) cannot be selected by a generic,
link-time, or specialization-constant parameter. The existing workaround of adding generic
parameters to builtin types (`matrix<T,R,C,L>`, `Ptr<...>`) is criticized as breaking and
ugly. It floats two options: (1) one parameterized attribute per choice space, for example
`[InterpolationMode(M)]`, with the existing keywords becoming sugar for it; (2) an `@expr` prefix
that puts an expression into the role of a modifier (`@M varying float2 uv`). It states "I don't
actually have a preferred solution (yet)", and a language proposal would come later.

**Disposition: held, nothing dispatched or posted.** Same class as
[[project_13956_name_lookup_overload_resolution_overhaul_202c]] and
[[project_13719_unqualified_name_lookup_umbrella]]: a maintainer-owned design item with no
bug-report shape and no ask of the bot (rung 4 of
[[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]]).

**Resume** only on a comment that @-mentions @nv-slang-bot, or on an operator ask. Mentions arrive
as webhooks, so no re-chase timer.
