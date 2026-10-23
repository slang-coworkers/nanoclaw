---
type: project
name: project_13882_entry_point_representation_proposal
description: "slang#13882 (tangent-vector, MEMBER, 10-23 00:44Z; assigned to its author by jhelferty-nv at 00:44:56Z): long design proposal 'Improve the compiler's representation of entry points' (canonical entry_point/entry_point_code AST+IR encoding, IREntryPoint nesting, warn-then-error on module-scope varyings). Maintainer-owned plan, nothing asked of the bot -> held: NO dispatch, NO bot post."
metadata:
  node_type: memory
  type: project
---

# slang#13882 — canonical representation of entry points (design proposal)

**10-23 00:44Z, `issue_opened`.** Live read at routing time: open, 0 comments, no labels, no type, no
milestone, body ~34 KB. Author **tangent-vector** (MEMBER). The timeline holds one event: `assigned` to
tangent-vector by **jhelferty-nv** at 00:44:56Z (11 s after filing). The only session on
`gh-issue-shader-slang/slang-13882` is this Main webhook session (`sess-1792716287822-ye3kq5`); no task.

**What it proposes.** Entry points and their varying parameters keep every degree of freedom of the
HLSL-style and GLSL-style surface forms through checking, lowering and IR, so many passes handle both
encodings (entry-point/subroutine splitting, `in`→`borrow` rewriting, globals→params threading, then
params→globals again for SPIR-V/GLSL). The fix direction is a canonical encoding: an `entry_point`
scope that owns all varying params, with an `entry_point_code` body, constructed systematically from
either style, and lowered to a nested `IREntryPoint`/`IREntryPointCode` with per-target legalization.
It also proposes new diagnostics: warn on module-scope varyings in Slang/HLSL (error in Slang 202c),
and errors now for importing a module with module-scope varyings, a second entry point from such a
module, or calling its entry-point function.

**Disposition: held, nothing dispatched or posted.** Rung 4 of
[[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]]: a maintainer-written plan with its own
fix direction, assigned to its author by a peer maintainer. Same class as
[[project_13719_unqualified_name_lookup_umbrella]]. A triage comment on a design RFC would be noise, and
the bot waits on human issues (R6, #13596).

**Resume** only on a comment that @-mentions @nv-slang-bot, or on an operator ask. A mention arrives as
a webhook, so no re-chase timer is needed. Sub-issues filed later get their own `issue_opened`.
