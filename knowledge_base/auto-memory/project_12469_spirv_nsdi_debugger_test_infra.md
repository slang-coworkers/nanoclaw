---
name: project_12469_spirv_nsdi_debugger_test_infra
description: "slang#12469 (zangold-nv, self-assigned): add a software SPIR-V debugger + execution model so slang-test can regression-test NSDI debug info. TRIAGED 08-11, design-gated, NO fixer dispatched — awaiting the author's answers to 4 design points. RESUME on any human comment. Key scoping facts: slang-test ALREADY executes SPIR-V 1336x via render-test and just never observes debug info; spirv-val's ValidateExtInstDebugInfo already structurally validates 16 of the 19 NSDI opcodes Slang emits, under SLANG_RUN_SPIRV_VALIDATION=1 in PR CI."
metadata:
  node_type: memory
  type: project
  originSessionId: webhook-12469-issue-opened
---

# slang#12469 — SPIR-V debugger & execution model for NSDI regression testing

**State as of 2026-08-11 07:0xZ:** triaged, **design-gated, no fixer dispatched.**
Chain: webhook `issue_opened` → me → `slang-triager` on `gh-issue-shader-slang/slang-12469`.
Public artifact: [issuecomment-5248760044](https://github.com/shader-slang/slang/issues/12469#issuecomment-5248760044)
(9082 chars, bot-authored, `comments 0→1`). Triager memo `triage-12469.md` at
`/workspace/inbox/a2a-1786420302249-ochj23/` on my edge.

Live issue state at my read (this turn): `labels:["Dev Opened"]` (set by **jkwak-work**, not the
author), `assignees:["zangold-nv"]`, `type:Feature`, `milestone:null`, `state:open`.

## The ask

Debugger UX on slangc-generated SPIR-V regresses and ships. OP wants (1) a software SPIR-V debugger
that consumes SPIR-V-with-debuginfo and reports GDB-like state about the 'running' program, and (2)
slang-test integration + regression tests over it.

## The two scoping facts that change the size of the work

Both verified by me independently on my own clone at master `1ca1aa50e` — not taken on the triager's
word (it had six defective figures this session, five caught by codex, so its numbers needed a check):

1. ✅**slang-test already executes SPIR-V — it just never looks at the debug info.**
   `tools/render-test/render-test-main.cpp:1705` sets `input.target = SLANG_SPIRV` for
   `DeviceType::Vulkan` (I read the lines; the `case DeviceType::Vulkan:` block is exactly there).
   Triager's counts: **1336** `-vk COMPARE_COMPUTE` directives (control 4424 total), and **0** files
   in `tools/render-test/` mentioning `DebugSource`/`NonSemantic`/`DebugLine`/`debugLevel` (control
   `spirv` = 4). So the gap is *observation*, not *execution* — the sharp framing, and it is NOT what
   the issue body says. ⇒ the honest headline is **86 textual `SIMPLE` `-g1/2/3` directives vs 0
   executing directives with debug info on a SPIR-V target.**
2. ✅**`spirv-val` already covers most of a "NSDI self-consistency verifier".**
   `ValidateExtInstDebugInfo` (spirv-tools `validate_extensions.cpp:3486`) structurally validates
   **28** NSDI opcodes — **16 of the 19** Slang emits — and PR CI already runs
   `SLANG_RUN_SPIRV_VALIDATION=1`. This killed the generic verifier the triager was about to
   recommend; it survives only re-scoped to the 3 unvalidated records + 8 validator TODOs.
   ⚠Provenance note worth keeping: that probe first returned **0 with a firing control** because the
   enum prefix was guessed — real prefix is `CommonDebugInfo*`, **not**
   `NonSemanticShaderDebugInfo100*`. A guessed identifier is how this one nearly stayed invisible.

## Cheapest evidenced first slice (independently landable)

Re-enable `tests/spirv/debug-variable-scope.slang`. Verified on my clone: the file exists (2245 B) and
line 1–2 read

```
// Regressed with SPIRV update. Tracking on github issue #8522
//DISABLE_TEST:SIMPLE(filecheck=CHECK):-target spirv-asm -entry main -stage fragment -g2 -emit-spirv-directly
```

i.e. it is `DISABLE_TEST`, not `TEST`, with **#8522** tracking the regression. Disabled since
2025-09-23 per the triager. A PR that fixes the underlying regression and flips `DISABLE_TEST` →
`TEST` needs no new infrastructure at all.

⚠️**A new `tests/spirv/` test is PR-BLOCKING**, unlike the advisory nightly: PR CI runs with
`test_roots=()`, i.e. the default `tests/`. Relevant to how aggressively any first slice lands.

## Withdrawn claim — do not resurrect it

The triager withdrew *"177 `emitOp*` templates vs 33–36 opcodes in a real NSDI test shader ⇒ ~1/5 the
work."* Counts real, **inference invalid**: both sample shaders are straight-line (no branches/loops/
`OpPhi`/calls/divergence), one opcode hides a set, and an opcode count omits module decoding, resource
binding, capability rejection and every debugger-specific concern. Published as a hint; the issue asks
OP for a supported/rejected **feature matrix** instead of a fraction. ⇒ if this figure reappears in any
future summary of #12469, it is a resurrection of a retracted claim.

## RESUME

**Trigger: any human comment on #12469.** If zangold-nv picks a direction or asks for a PR → release
`slang-fixer` on thread `gh-issue-shader-slang/slang-12469`.

The 4 design points he owes answers to: supported/rejected feature matrix · what a test actually
asserts · new tool vs a slangc mode · inline-vs-separate debug info.

⚠**Formatters were absent on the triager's edge this day** (`clang-format` / `gersemi` / `prettier` /
`shfmt`) ⇒ whoever authors the PR must run `extras/formatting.sh` themselves and must not assume the
dispatching tier verified formatting.

## What this chain cost me

My dispatch carried **`LABELS: (none)`** — stale within **1–8 seconds** of filing, and a repeat of the
error I had already written a remedy for. Full derivation, the timeline table, and the standing
template change: [[feedback_a_live_artifact_read_is_a_measurement_with_a_timestamp]] (sixth instance).
Related: [[feedback_an_issue_body_is_a_frozen_pre_triage_snapshot]] — the issue body's *"slang-test
lacks the ability"* framing is exactly the pre-triage layer that fact #1 above supersedes; quoting the
body later would silently revert it.
