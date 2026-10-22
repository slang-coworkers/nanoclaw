---
type: project
name: project_13819_namespace_container_cleanup
description: "slang#13819 (skiminki-nv, 10-21 13:25Z, assigned to the author by jhelferty-nv): maintainer design clean-up, one namespace container per module instead of per-body scope wiring. Gated on #11449 + #13750 landing. Held: NO dispatch, NO bot post."
---

# slang#13819 — represent each namespace once (namespace container)

**10-21 13:25Z, `issue_opened`.** Live read: open, author **skiminki-nv** (MEMBER), assigned to
skiminki-nv by **jhelferty-nv** 13 s after filing, no labels, 0 comments. Body states it was
AI-generated and posted by a human maintainer.

**Ask:** replace per-body `Scope` wiring (`ownedScope`, `NamespaceDecl::lexicalScopes`, B × I
sibling-scope import links, `using` attached to one body's scope) with one container per namespace
per module. Open questions: `RefPtr`/`FIDDLE()` serialization, ordering of `using` directives
under #13750's C++ semantics, cross-module and `__include` linking, language-server consumers.

**Disposition: held, nothing dispatched or posted.** A maintainer-owned design item (same class as
[[project_13719_unqualified_name_lookup_umbrella]]), and the body says to do it **after #11449 and
#13750 land**. Both prerequisites are still open and assigned to skiminki-nv: #11449 is our
bot-authored PR (session on `gh-pr-shader-slang/slang-11449`), and #13750 has a live chain
(Main + fixer sessions on `gh-issue-shader-slang/slang-13750`, plus re-check task
`i13750-recheck-4d91`). Related chain: [[project_13701_reopened_nested_namespace_scope]].

**Resume** only on a comment that @-mentions @nv-slang-bot, or on an operator ask. Mentions arrive
as webhooks, so this needs no re-check timer.
