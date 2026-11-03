---
type: project
name: project_13882_entry_point_representation_proposal
description: "slang#13882 (tangent-vector, MEMBER; assigned to its author by jhelferty-nv; type Refactoring, milestoned): maintainer design proposal 'Improve the compiler's representation of entry points' (canonical entry-point scope + IREntryPointCode). 10-23 issue_opened and 11-03 00:11Z agent-authored rollout comment 6591811561 (no bot mention) both HELD: no dispatch, no bot post. Bears on parked #14000 (option C) and #13726/#13687."
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

**Between 10-23 and 11-02 (timeline):** tangent-vector cross-referenced #13730 (10-23) and #13899 (10-26), and set a
milestone and issue type `Refactoring` on 10-26. Bot triage comments on #14000 (10-29) and #14053 (11-02)
cross-referenced it, so the bot now "touches" the thread. Every human comment therefore arrives as `pr_mention`.

**11-03 00:11Z, `pr_mention` (comment [6591811561](https://github.com/shader-slang/slang/issues/13882#issuecomment-6591811561)).**
tangent-vector posted "agent: Proposed representation and rollout." The `agent:` prefix marks it as AI-authored.
It @-mentions nobody, so it is not a summons. Held: no dispatch, no reaction, no post. What changed from the
original proposal:
- Front end: a `ProgramParameterScope` hierarchy (global → GLSL-style module scope → `EntryPointParameterScope`).
  Entry-point checking no longer mutates the AST.
- IR: `IRParameterScope` plus a non-callable `IREntryPointCode`, one IR module per selected entry point, with
  linkage distinct from the implementing function. Nested linking: every inst with linkage needs a parent that
  has linkage, or an `IRModuleInst` parent.
- It softens the original "reject" stance. Multiple selected entry points that share module varyings get a
  **warning**, with varying-location reservations and per-entry-point scope copying. Source `import` of a module
  with module varyings is still rejected.
- Rollout step 3 replaces compiler-owned builtin backing globals with operations.
- 8-step rollout: checked parameter records → semantics → layout/builtins → IR foundations → entry-point IR
  modules → GLSL-style scopes → common passes → target legalization.

**Bearing on parked chains (operator FYI on 11-03, not a dispatch):**
- [slang#14000 chain](../slang/14000-linkage-decorations-non-public.md): option C ("B under #13882") now has a concrete linkage design to point to.
- #13726/#13687 (WGSL builtins across several entry points; parked on the operator): the softened multi-entry-point
  stance and rollout step 3 are relevant to the "maintainer direction pulls against the PR" note.
