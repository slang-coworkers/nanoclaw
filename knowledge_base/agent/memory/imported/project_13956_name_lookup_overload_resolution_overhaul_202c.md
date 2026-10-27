---
type: project
name: project_13956_name_lookup_overload_resolution_overhaul_202c
description: "slang#13956 (skiminki-nv, 10-26 16:06Z, self-assigned, label 'slang 202c'): maintainer design proposal for a decomposable LOOKUP/RESOLVE name-lookup + overload-resolution model in 202c (no silent semantic change from non-local decls, no lookup filter, accessibility detached, wildcard imports lowest priority). Asks nothing of the bot -> held: NO dispatch, NO bot post."
---

# slang#13956 — name lookup and overload resolution overhaul for Slang 202c

**10-26 16:06Z, `issue_opened`.** Live read: OPEN, author **skiminki-nv**, self-assigned, label
`slang 202c`, 0 comments, no milestone. Body is a full design spec: six characteristics (1: new
non-local declarations never silently change a result, they may only make it fail; 2–3: `LOOKUP`
and `LOOKUP+RESOLVE` decompose per scope so results can be cached; 4: no lookup filter for normal
symbols; 5: accessibility is checked after resolution, not during; 6: `using namespace` wildcard
imports get the lowest priority), then `LOOKUP_LOCAL` / `LOOKUP` / `RESOLVE` procedures and a
shadowing rule. Cites #13750, #13876, #13888 as motivation. Example: `Outer.fn(int)` silently
beating `Outer.Inner.fn<T>(T)`.

**Disposition: held, nothing dispatched or posted.** Same class as the umbrella
[[project_13719_unqualified_name_lookup_umbrella]], the design clean-up
[[project_13819_namespace_container_cleanup]] and [[project_13621_language_name_support_buckets]]:
a maintainer-owned design proposal with no bug-report shape and no ask of the bot.

**Overlap with live chains (not acted on):** #13750 (`using namespace` conflict resolution; the
assignee gave C++ semantics 10-21 — characteristic 6 may refine it), #13752 Part 1 (shadowing,
fixer parked on Q3), #13876 → PR #13880, #13888 → PR #13889. All are assignee-driven, so the
assignee reconciles them; a bot comment cross-linking them would be noise.

**Resume** only on a comment that @-mentions @nv-slang-bot, or on an operator ask. Mentions arrive
as webhooks, so no re-chase timer.
