---
type: chain
title: slang#13617 — WGSL target: support fragment SV_PrimitiveID
description: "rhendry, human-filed feature request: WGSL rejects SV_PrimitiveID (E55202). wgpu exposes PRIMITIVE_INDEX (WGSL `primitive_index` builtin, `enable primitive_index;`). Dispatched to slang-triager 2026-10-14."
---

# slang#13617

**2026-10-14 04:3xZ, webhook `issue_opened`.** Live read before dispatching: OPEN, 0 comments, no
labels, no assignee, human-filed by rhendry, `updated_at` = `created_at`, live body = payload. The
only session on `gh-issue-shader-slang/slang-13617` was this Main webhook session. `gh search`
found no duplicates ("primitive_index", "SV_PrimitiveID wgsl"). No task names it.

Orchestrator pointer (unverified, master 8230cdaeb3): `LegalizeWGSLEntryPointContext`
(`slang-ir-legalize-varying-params.cpp:5109`) maps `SystemValueSemanticName::PrimitiveID` to
`result.isUnsupported = true` (:5259, shared with RenderTargetArrayIndex). The Metal/other context
at :4487 maps it to `primitive_id` with UInt/UInt16. The docs table
(`docs/user-guide/a2-03-wgsl-target-specific.md:43`) lists it as unsupported. The WGSL emitter
already emits `enable` directives for extensions (`slang-emit-wgsl.cpp` ~:1823/:1913, f16/subgroups),
which is the likely model for capability-gating `enable primitive_index;`.

Dispatched to `slang-triager` on `gh-issue-shader-slang/slang-13617`.

**2026-10-14 04:58Z, triaged** (slang-triager, [cmt 6161247791](https://github.com/shader-slang/slang/issues/13617#issuecomment-6161247791),
checked live: nv-slang-bot, labels `WebGPU` + `reproduced`, no assignee, no PR; memo
`/workspace/inbox/a2a-1791953987944-z69z93/triage-13617.md`). Feature / medium / P2 / WGSL target-emit. The triager reports:
WGSL CRD defines `primitive_index` (fragment, u32 input) gated by `enable primitive_index;`. naga 30.0.1 rejects a missing
`enable` and an `i32` type. Chrome 142 / Tint and wgpu 29 support it. **Approach A:** split PrimitiveID from
RenderTargetArrayIndex (:5260) → `primitive_index`, uint only. Add a `requiredTargetExtension` field to `SystemValueInfo` so
`legalizeSystemValue` attaches `addRequireWGSLExtensionDecoration`; the existing emitter path writes the `enable`. No capability
atom. Docs row :43 + tests/wgsl FileCheck test. The reverted prototype passed 5 naga shapes and a 905/905 subset. B (emitter
string-match) and C (capability atom opt-in) were rejected.

**Disposition (orchestrator, 2026-10-14 ~05:05Z).** GO on Approach A as a draft PR with `Fixes #13617`. This uses the standing
proactive authority, drafts only: the reporter is external, nobody is assigned, there's no in-flight PR, and the triage comment
already says a draft PR can follow maintainer confirmation. The PR body notes the approach still needs maintainer confirmation.
Out of scope: the triager's side note that a raw `uint : SV_WaveLaneIndex` entry param emits `@builtin(subgroup_invocation_id)`
with no `enable subgroups;` (spec requires it; naga accepts it, Tint unchecked). Unfiled, operator call; asked on the dashboard.
Routed through slang-triager on `gh-issue-shader-slang/slang-13617` (fixer briefing already staged there).
**Resumes on:** the fixer's draft PR, a human comment on the issue, or the operator's answer on the side note.

**2026-10-14 07:07Z, draft PR [#13619](https://github.com/shader-slang/slang/pull/13619)** (verified live: open, draft,
nv-slang-bot, `fix/issue-13617` @ 013dcca5ed, `pr: non-breaking`, body closes #13617, 3 files +96/−1: legalizer
`SystemValueInfo::requiredWGSLExtension` + PrimitiveID→`primitive_index` u32, docs row, `tests/wgsl/semantic-primitive-id.slang`
with 6 cases). pr-mapping → slang-fixer `sess-1791954025104-jckcwj` on the canonical thread. Triage comment 6161247791 edited in place
to point at #13619 (still the only comment). No subgroups change, as scoped. CI hasn't run (draft).
**Next:** slang-reviewer pass → fixer [Fix Report] → triager [Triage Resolution]. Ready/merge is operator-gated; the approach
still needs maintainer confirmation. The SV_WaveLaneIndex side-note question to the operator (dashboard msg 13) is still unanswered.

**2026-10-14 07:13Z, interim Fix Report** (via triager): 6/6 new tests pass. The fixer's explain comment is 6162829561. CI dispatch
38525347723 skipped its matrix because the head commit is docs-only (the filter diffs HEAD^1). Real CI runs on the next code push or at
ready. The board-sync bot assigned **jkwak-work** and requested a review. Tint/wgsl-spirv is unverified (no local Tint).
**Side finding (a), GO to file (orchestrator, ~07:20Z):** on WGSL, an `int` system-value field inside a nested struct
(`struct Inner { int s : SV_SampleIndex; }; struct Outer { Inner i; };` as a fragment param) gives E99999 "unexpected IR opcode
during code emit", rc 255. **I reproduced it on local Release slangc @ 8230cdaeb3**: `uint` compiles; metal and spirv compile both.
Dedup: no match; nearest is #13379 (CopyLogical via buffer struct copy, a different path). The triager files it as Type=Bug,
`reproduced`+`WebGPU`, unassigned, **unrouted** (no fixer). Precedent: #13350→#13355 and #13544→#13545 follow-ups filed under
standing authority. This differs from the subgroups side note, which naga accepts, so it isn't a crash and is still the operator's call.
**07:20Z, filed [#13620](https://github.com/shader-slang/slang/issues/13620)** (checked live: open, nv-slang-bot, `WebGPU`+`reproduced`,
no assignee, 0 comments, 2032 chars, opens "Found while working on #13619 (#13617)"). It's unrouted, so its own `issue_opened` webhook is a
self-echo and needs no dispatch. No cross-link from #13619 (it would need new text).

**2026-10-14 10:18Z, Triage Resolution** (verified live: #13619 open draft @ b5340af7ab, 5 files +277/−18, jkwak-work assigned and
review-requested, 0 GitHub reviews). Internal slang-reviewer R1 REQUEST_CHANGES: a global `in` in vertex/compute emitted
invalid WGSL, and the builtin leaked under `-ignore-capabilities`. Both fixed. R2 APPROVE_WITH_NITS, nits applied. Tests 13/13 + subsets.
CI dispatch 38546790314 (ref `fix/issue-13617-ci`, code commit f58c7dae03) is waiting at the priority gate. The full matrix runs only after ready.
**Follow-up 1, GO to file (orchestrator ~10:2xZ):** global `in uint s : SV_SampleIndex` in a vertex entry compiles rc 0 on wgsl and puts
`@builtin(sample_index)` on an `@vertex` fn; the param form gives E30702. **I reproduced it on local Release 8230cdaeb3.** Dedup was empty
(#13209 and #6319 are not it). Reviewer's pointer: `validateSystemValueSemantic` slang-check-shader.cpp ~2020. Filed as [#13622](https://github.com/shader-slang/slang/issues/13622) 10:26Z (checked live: bot, unrouted; its issue_opened is a self-echo).
Whole-module shared-global-`in` var<private> note: noted only, not filed.
**Parked on:** maintainer approach confirmation + operator `gh pr ready` decision. Re-chase `rechase-13617-primitive-3220`
(one-shot, 2026-10-15T10:30Z). Chain rests; the triager sends FINAL on merge.
**2026-10-14 20:43Z, #13622 is maintainer-owned.** jhelferty-nv assigned it to tangent-vector (Q1 2027). tangent-vector's design notes
(comment 6178020266) say the fix is front-end: check global varyings and entry-point params as one combined list. They also propose
making it an error to use both forms, warning on global `SV_` varyings, and diagnosing global varyings outside GLSL mode.
The bot does nothing on #13622. **For #13619:** its legalizer stage check for global `in` (`checkSystemValueUse`) is a backend backstop that
this front-end direction would likely supersede. I flagged it to the operator only. No action unless a maintainer raises it on #13619.
**2026-10-15 10:31Z, re-chase (case d).** Checked live: #13619 is still an open draft @ b5340af7ab, 0 reviews, and no human comments on
#13617 or #13619 since 10-14 10:18Z. One human event: **jkwak-work milestoned #13617 "Q4 2026 (Fall)"** at 10-14 17:08Z (no comment).
CI dispatch 38546790314 is still `waiting` at the priority gate. Both operator decisions (`gh pr ready`, SV_WaveLaneIndex file-or-leave)
were unanswered on the dashboard, so I re-asked **once** (dashboard msg 5, canonical thread). Next ask: don't re-ask again, list it as pending.
Re-armed one-shot `rechase-13617-primitive-3ec6` (2026-10-17T10:30Z). No GitHub posts.
**2026-10-17 10:33Z, re-chase (case d).** Checked live: #13619 is still an open draft at b5340af7ab with 0 reviews, and there are no human
comments or timeline events on #13617 or #13619 since 10-14 17:08Z (the milestone). CI dispatch 38546790314 is still `waiting`. Neither operator
decision has an answer (dashboard read with the bounded --reverse/--since-seq calls; the Main canonical session was last active 10-14 10:26Z).
I listed both as pending and **didn't re-ask** (dashboard msg 21, canonical thread). Re-armed one-shot `rechase-13617-primitive-316c` (2026-10-19T10:30Z). No GitHub posts.
**2026-10-19 10:3xZ, re-chase (case d).** Checked live: #13619 is still an open draft at b5340af7ab with 0 reviews, and there are no human
comments, reviews or timeline events on #13617 or #13619 since 10-14 17:08Z. **CI dispatch 38546790314 now returns 404** and `fix/issue-13617-ci`
has no runs (other repo runs list normally), so it probably expired at the priority gate. That's harmless; the full matrix runs at ready. Neither operator
decision has an answer (bounded dashboard read; no operator row mentions 13617/13619 after msg 505608). I listed both as pending and didn't re-ask
(dashboard msg 7, canonical thread). Re-armed one-shot `rechase-13617-primitive-320f` (2026-10-21T10:30Z). No GitHub posts.
**2026-10-21 10:3xZ, re-chase (case d).** Checked live: #13619 is still an open draft at b5340af7ab, with 0 reviews and 0 inline comments. No human
comments, reviews or timeline events on #13617 or #13619 since 10-19 10:30Z. There are no runs on `fix/issue-13617` or `-ci`. Neither operator decision has an
answer (bounded dashboard reads `--reverse --limit 300` plus `--since-seq 505608 --limit 400`: no operator row mentions 13617/13619; the Main canonical
session was last active 10-14 10:26Z). I listed both as pending and didn't re-ask (dashboard msg 9, canonical thread). Re-armed one-shot `rechase-13617-primitive-73cf`
(2026-10-23T10:30Z). No GitHub posts.
**2026-10-23 10:3xZ, re-chase (case d).** Checked live: #13619 is still an open draft at b5340af7ab, with 0 reviews and 0 inline comments. No human
comments, reviews or timeline events on #13617 or #13619 since 10-21 10:30Z (latest human event is still the 10-14 17:08Z milestone). There are no runs on `fix/issue-13617`.
Neither operator decision has an answer (bounded dashboard reads `--reverse --limit 300` plus `--since-seq 506600 --limit 400`, which together cover 10-21 10:30Z→10-23 10:30Z:
no row mentions 13617/13619/WaveLane/subgroups other than my own 10-21 status; the Main canonical session `sess-1791952546270-bc3zew` was last active 10-14 10:26Z).
I listed both as pending and didn't re-ask (dashboard msg 9, canonical thread). Re-armed one-shot `rechase-13617-primitive-6dc8` (2026-10-25T10:30Z). No GitHub posts.
