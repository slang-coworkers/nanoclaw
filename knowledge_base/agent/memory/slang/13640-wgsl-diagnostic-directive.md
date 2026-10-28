---
type: chain
title: slang#13640 — WGSL: emit `diagnostic(...)` directives/attributes
description: "albertrodriguezclo, human-filed feature request: Tint rejects subgroup ops in non-provably-uniform control flow; WGSL has `diagnostic(off, subgroup_uniformity)` but Slang can't emit it. Dispatched to slang-triager 2026-10-15."
---

# slang#13640

**2026-10-15 13:1xZ, webhook `issue_opened`.** Live read before dispatching: OPEN, 0 comments, no
labels, no assignee, human-filed by albertrodriguezclo, `updated_at` = `created_at`, body 1987
chars (matches payload). The only session on `gh-issue-shader-slang/slang-13640` was this Main
webhook session. `gh search` found no duplicates ("subgroup_uniformity", "wgsl diagnostic
directive", PRs "diagnostic subgroup_uniformity"). No task names it.

Reporter: Slang 2026.19 + Tint (Dawn v20261009), `WaveActiveSum` under a data-dependent `if` →
Tint "'subgroupAdd' must only be called from subgroup uniform control flow". Asks for an attribute
(e.g. `[__wgsl_diagnostic(off, subgroup_uniformity)]`) or a compiler option. Their workaround is
`__requirePrelude("diagnostic(off, subgroup_uniformity);")` inside a `__target_switch case wgsl:`.

Orchestrator pointer (unverified, master 6597ec9202): `WGSLSourceEmitter::emitFrontMatterImpl`
(`slang-emit-wgsl.cpp:1819`) emits `enable f16;` and the extension tracker's `enable` lines; no
`diagnostic` emission exists anywhere in `source/` or `docs/`. Module-scope directives would sit
next to that front matter; `@diagnostic` on functions/statements would need an attribute through
lowering to an IR decoration.

Dispatched to `slang-triager` on `gh-issue-shader-slang/slang-13640`.

**2026-10-15 13:44Z, triaged** (slang-triager, [cmt 6193536016](https://github.com/shader-slang/slang/issues/13640#issuecomment-6193536016),
checked live: nv-slang-bot, label `reproduced`, Type=Feature, no assignee, no PR; memo
`/workspace/inbox/a2a-1792071846121-n6uf0a/triage-13640.md`). Feature / medium / P2 / WGSL target-emit. The triager reports:
it reproduced the error on master 6597ec920 with the Dawn null backend (`webgpu@0.6.2` dawn.node; naga can't run Tint
uniformity), at the reporter's line and column 13:25. Three hand edits pass: a module directive, `@diagnostic` on the fn, and
on the `if`. `@diagnostic` on a fn does **not** cover callees. The `__requirePrelude` workaround has a verified hazard:
`fn _slang_getNan()` emitted before the directive → "directives must come before all global declarations". Also: a
conflicting severity for the same rule is a Tint error, an unknown rule only a warning, and `derivative_uniformity` is
independent. **Recommended A**: a repeatable compiler option feeding a front-matter directive set after
`appendExtensionRequireLinesForWGSL` (`slang-emit-wgsl.cpp:1828`), new `CompilerOptionName` appended at 164. B (a source
attribute) is fragile under inlining; C (a structured internal request) is the shared backend. cc'd bmillsNV (#8774).
Related: #8774, #6962, #13636.

**Disposition (orchestrator, 2026-10-15 ~13:47Z).** PARKED on a maintainer design decision. Unlike #13617 there is no
proactive draft: the user-facing surface (an option name, or an attribute) is the open question itself, and the triage
comment asks a maintainer to pick it. The triager's re-check `recheck-13640-dbd8` **did exist**. I wrongly reported it missing: from inside Main's container, `ncl tasks list --all`/`--group <other>` and `ncl tasks get` are auto-scoped to Main's own group, so another group's tasks are invisible. The triager cancelled its task at 13:49Z, and Main's `recheck-13640-diag-surfa-f817` (one-shot, 2026-10-22T14:00Z) is now the only one. The triager's state page `memory/issues/13640.md` points at it, and its brief now requires the docs caveat "opt-in, you assert correctness".
**Resumes on:** a human comment on the issue (webhook), or the 10-22 re-check.

**2026-10-15 16:45Z, handed off to the maintainer and the reporter.** Live read: jkwak-work (repo admin) labeled it `WebGPU` at
15:53Z and self-assigned at 16:06Z. The reporter albertrodriguezclo then commented ([cmt 6197344014](https://github.com/shader-slang/slang/issues/13640#issuecomment-6197344014),
no bot mention) with an option-A spec: `-wgsl-diagnostic <severity>:<rule>`, repeatable, severity validated and rule passed
through unchanged, `CompilerOptionName::WGSLDiagnostic` (stringValue0/1 like `MacroDefine`), emitted in `emitFrontMatterImpl` after
the `enable` lines, last severity wins, other targets ignore it. They said "I'm opening a PR with this shape now". No PR yet at 16:4xZ.
**Disposition:** no dispatch. The reporter is implementing, a maintainer owns the issue, and a bot reply or a competing fixer PR would be noise.
The webhook was not an @-mention, so nothing was authorized to post. I updated `recheck-13640-diag-surfa-f817`
(10-22) to record the reporter's PR number or stop. The `issue_opened`/`pr_opened` webhooks for their PR are not ours to review
unless a maintainer asks. **Resumes on:** a human comment that asks the bot something, or the 10-22 re-check.

**2026-10-15 16:49Z, reporter PR [#13660](https://github.com/shader-slang/slang/pull/13660)** ("WGSL: add -wgsl-diagnostic to emit
diagnostic directives", branch `fix/wgsl-diagnostic-directive`, assigned jkwak-work and albertrodriguezclo). As of 10-21 it has
only bot reviews (coderabbit, github-actions) and the reporter's own replies, with no human maintainer review. It is not ours:
there is no `pr-mappings` row.

**2026-10-21 22:22Z / 22:24Z, maintainer comments** (jkwak-work, MEMBER, no bot mention):
[6327842807](https://github.com/shader-slang/slang/issues/13640#issuecomment-6327842807), "If Tint takes command-line arguments
for silencing such warnings, Slang already has a way to pass-through command-line arguments" (links the `-X` reference), then
[6327885252](https://github.com/shader-slang/slang/issues/13640#issuecomment-6327885252), "I will discuss this feature request in
the meeting later this week."
Orchestrator check (master ffbd1771e5): slangc runs Tint only for WGSL→SPIR-V (`TintDownstreamCompiler::canConvert`,
`slang-tint-compiler.cpp`), and `tint_CompileRequest` (`external/slang-tint-headers/slang-tint.h:6`) carries only
`wgslCode`/`wgslCodeLength`. So `-Xtint` arguments never reach Tint, and in any case the reporter's failing Tint is the
browser's (Chrome/Dawn), which a slangc flag cannot affect. That is a factual gap in the maintainer's suggestion.
**Disposition:** no dispatch and no post (no mention, so not authorized; a maintainer meeting is pending). I surfaced the gap
to the operator as an optional post. I moved `recheck-13640-diag-surfa-f817` to **2026-10-27T14:00Z** (after the meeting) and
updated its prompt to cover #13660. (`ncl tasks update` returned before its change showed up on a re-read; check with `get`
after 30-60 s before retrying.)

**2026-10-21, reporter answered the `-X` gap themselves** ([cmt 6328100164](https://github.com/shader-slang/slang/issues/13640#issuecomment-6328100164),
albertrodriguezclo, no bot mention). Their points: `-target wgsl` doesn't run Tint, and the failure is in the browser's
`createShaderModule`. For `wgsl-spirv`, `TintDownstreamCompiler::compile` passes only the source, and standalone `tint` has only
`--allow-non-uniform-derivatives`, which inserts the same directive. They offered to respell #13660 after the meeting. This
covers the gap I had raised, so the optional triager post I offered the operator is **withdrawn**. No dispatch. The 10-27 re-check stands.

**2026-10-22 13:01Z, maintainer questions to the reporter** ([cmt 6341402001](https://github.com/shader-slang/slang/issues/13640#issuecomment-6341402001),
jkwak-work, MEMBER, no bot mention). They ask (1) "Do you mean `-X` is not working for Tint? If that's the case, we should fix
it." and (2) whether Tint's CLI flag is too coarse to limit the behavior to subgroup. They also raise a concern: `diagnostic(...)`
"sounds like `#pragma` in DXC and Slang doesn't support DXC specific `#pragma`", some rules "will be Tint version dependent and
it will be difficult for us to test in the current testing framework". So the maintainer now leans skeptical of #13660's shape.
**Disposition:** no dispatch and no post. The questions are addressed to the reporter, and there is no mention.
**Possible follow-up (not ours unless asked):** if the reporter confirms (1), "`-Xtint` arguments are silently dropped" is a
separate, real gap. Orchestrator receipt: `tint_CompileRequest` has only `wgslCode`/`wgslCodeLength`. If a maintainer asks for
an issue, file it then. The 10-27 re-check stands.

**2026-10-27 14:0xZ, re-check `recheck-13640-diag-surfa-f817`: no change.** #13640 OPEN (assignee jkwak-work; labels WebGPU, Office-Tess (added 10-21 22:24Z), reproduced); its last comment is still jkwak-work's 10-22 13:01Z questions. No meeting outcome has been posted. #13660 OPEN, non-draft, head 425771bcf8, `reviewDecision` empty; reviews are only from bots and the reporter. Its last activity is the reporter's CodeRabbit replies on 10-22 13:34Z/13:47Z. On 10-26 22:38Z, in a comment on #13693, the reporter asked for fork CI-run approval on about 45 of their PRs, #13660 included. That is not a decision. Nobody mentioned the bot. No dispatch, no post, not re-armed. The chain now resumes only on a webhook.
