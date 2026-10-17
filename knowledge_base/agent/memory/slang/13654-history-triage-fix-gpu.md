---
type: chain
title: slang#13654 — triage, fix rounds and GPU re-verification (history)
description: "Settled, condensed history of slang#13654 / DRAFT PR #13681, 10-15 14:3xZ to 10-16 09:22Z: dispatch, [Triage] (A+C), the fixer's re-plan to a legalizer-side E38204, the newly-rejected-shapes inventory, review rounds R1/R2, [Fix Report], [Triage Resolution], and the L40S GPU A/B. Split out of the live record [[13654-metal-structuredbuffer-texture-field-abort.md]]."
tags: [slang, metal, legalization, structuredbuffer, history]
resource: https://github.com/shader-slang/slang/issues/13654
---

# slang#13654 — history (triage → fix → GPU re-verification)

Settled history split out of the live record [[13654-metal-structuredbuffer-texture-field-abort.md]]
during okf-synthesis (2026-10-16). Superseded progress pings were collapsed into the report that
replaced them. "Unverified by me" marks a coworker's claim I did not re-run.

## Dispatch (10-15 14:3xZ, webhook `issue_opened`)

Read live first: OPEN, 0 comments, no labels/assignee, human-filed by albertrodriguezclo (same reporter
as the #13631–#13646 batch). Only session on `gh-issue-shader-slang/slang-13654` was this Main webhook
session; no memory, `conversations/` or `gh search` duplicate. Adjacent, not a duplicate: open **#12529**
(statement-form `__intrinsic_asm` `$N` past its args) hits the same `argIndex < m_argCount` release assert
(`slang-intrinsic-expand.cpp:406`, also :891/:915 at 6597ec9202). The reporter's IR shows
`_Texture.SampleLevel` with 3 args — the texture operand is gone. Dispatched to `slang-triager`.

## Triage (10-15 14:36Z progress → 15:02Z [Triage], comment 6195242328)

Reproduced at 6597ec9. HLSL/SPIR-V/GLSL/WGSL reject with E38204; CPU and CUDA compile it (CUDA emits
`tex2DLod(materials.Load(i).t, …)`); **Metal is the only target both exempt from E38204 and still running
`legalizeResourceTypes`.** My receipts at 6597ec9: `StructuredBufferValidationContext::validate`
(`slang-ir-validate.cpp:931`, called `slang-emit.cpp:2035`) returns early on `areResourceTypesBindlessOnTarget`
(`slang-type-layout.cpp:3549-3551`, CPU||CUDA||Metal); validator (:2035) and `legalizeResourceTypes` (:2049) both
sit under `if (options.shouldLegalizeExistentialAndResourceTypes)` (:1976), false only for C/CPP/CUDA source.

[Triage]: Bug / medium / Metal emit + IR type legalization / P2, not a regression. Two gaps combine:
- (a) Metal was added to the bindless predicate for DescriptorHandle layout (#6028); the validator skip's
  only live effect is on Metal (inferred accidental — #8222 covers CPU/CUDA only; E38204 tests are SPIR-V-only).
- (b) `Material` becomes a tuple; the SB-type `default:` arm (`slang-legalize-types.cpp:1416-1417`) returns the
  buffer `simple`; `kIROp_StructuredBufferLoad` (`slang-ir-legalize-types.cpp:2193-2198`) returns none;
  `LegalCallBuilder::addArg` drops it → 3 args vs `$c$0.sample(...)` → the assert.
- Approaches A (Metal gets E38204), B (argument-buffer lowering — a feature, parked), C (legalizer fails loudly).
  Recommended A + C. #12529 ruled out; closest mechanism #13106 (closed). Label `reproduced`, Type=Bug set.
- Unfiled side finding: `uniform Material* p` asserts at `slang-ir-legalize-types.cpp:3504` on Metal and SPIR-V.

## Fix: plan A+C → producer-side re-plan (10-15 15:05Z → 19:09Z)

- **15:53Z** — fixer deviated: dropping the skip would newly reject `StructuredBuffer<Texture2D>` on Metal (compiles
  today to the same MSL as `Texture2D.Handle`), so it narrowed A to resources inside aggregate elements, C at 1416 only.
  I asked why CPU/CUDA escape the rule (they never reach the validator).
- **18:09Z** — `/code-review medium` found two regressions (fixer-confirmed master vs HEAD): A newly rejects
  `SB<Ptr<Texture2D>>` / struct-with-`Ptr<Texture2D>` on Metal; C newly ICEs `SB<ConstantBuffer<M{Texture2D}>>` and
  `DescriptorHandle<StructuredBuffer<M>>`. **Re-plan:** the legalizer at `slang-legalize-types.cpp:1416` reports
  E38204 and stops; validator reverts to master; 2193 becomes `SLANG_RELEASE_ASSERT`. I asked for a use-site
  location, de-duplication, and a newly-rejected-shapes inventory with a label call.
- **19:06Z prototype** (unverified by me) — pass returns `SLANG_FAIL` (no E99997); repro points at `materials` 2:28
  like SPIR-V; one E38204 per buffer. Newly rejected: Metal `SB<ConstantBuffer<M{Texture2D}>>` never dereferenced;
  `DescriptorHandle<SB<M{Texture2D}>>` on HLSL/SPIR-V. Still compiles on Metal: `SB<Texture2D|Texture2D[2]|SamplerState>`,
  DescriptorHandle fields, `Ptr<Texture2D>`. Former ICEs now E38204: `SB<SB<M>>`, `static` SB, structs with CB/SB fields.
- **19:09Z, label gap closed** — master SPIR-V for `DescriptorHandle<SB<M{Texture2D}>>` fails validation
  (`VUID-StandaloneSpirv-None-04667`, then E99999) and field/sample uses ICE at `:2197`, so no use was valid on master
  → **`pr: non-breaking` holds** (HLSL/GLSL output invalid; dxc/glslang not run).

## PR #13681 and review rounds (10-15 20:02Z → 10-16 07:45Z)

- **20:02Z DRAFT @dbf98aab69** — 7 files (`diagnoseUnlegalizableStructuredBuffer` in `slang-legalize-types.cpp`,
  release assert in `slang-ir-legalize-types.cpp`, 3 tests), `Fixes #13654`, `pr: non-breaking`, jkwak-work assigned;
  `pr-mappings` → fixer `sess-1792076538832-j7oqw9`. Short body form; full Process report in explain comment
  6201118996. Issue status comment 6201285206. CI draft/approval-gated throughout.
- **22:40Z R1 (REQUEST_CHANGES, small) applied → 500a07ba31** — phi params no longer get their own E38204; only the
  resource-legalization context reports split SB elements (else `SLANG_UNEXPECTED`), so the SB-load assert holds by
  construction. New inventory row: `static StructuredBuffer<S{Texture2D}>` now E38204 on SPIR-V/HLSL/GLSL/WGSL (master:
  E99997 debug, empty kernel release) — still non-breaking.
- **10-16 07:42Z R2 (APPROVE_WITH_NITS) applied → 87c393db2e** — location-pinning tests, master merge (dc1d76ec5d).
- **07:45Z [Fix Report]** — 9 files +499/−9; `collectGlobalUniformParameters` keeps the param location on its
  GlobalParams key; repro 8/8 (master 7/8 fail); Devin still flags `:2197` (fixer: unreachable via the hook). Deferred,
  unfiled: validator reports a struct field at the struct's location. The report reached only me; I forwarded it
  verbatim to the idle triager session `sess-1792074955085-5ivol4` (msg 89, pinned).
- **07:48Z [Triage Resolution]** — triager endorses the producer-side departure (covers A + C; B not attempted), no new
  GitHub post (6201285206 supersedes 6195242328); its state page is the triager's `memory/issues/13654.md`.

## GPU re-verification (10-16 07:54Z → 09:22Z)

Operator notice: containers had no GPU passthrough ~09-28 → 10-16 07:33Z, so the 10-15 A/B skipped vk/cuda (~1.6k vk,
~1.4k cuda ignored). The change sits in `legalizeResourceTypes`, on every SPIR-V/HLSL/GLSL/WGSL compile, so I asked the
fixer (msg 105) to rerun on the L40S.
- **09:05Z slang-reviewer** — R2 suites re-run at 500a07b (not head) on the L40S: 0 failures, 2,101 vk/cuda rows newly passing.
- **09:22Z fixer [Report]** — full `slang-test` on the L40S, master then 87c393d: **no fix-only failures**; fix 10664/10683
  incl. 1465 vk + 1353 cuda; its 19 failures (fp8 coop-matrix CUDA, `functional/*`, CPU gfx-smoke) also fail on master;
  master had more device-creation errors (59 vs 10). Correction: its 10-16 06:44Z run already had the GPU. PR Tests line
  and explain comment 6201118996 (09:22:32Z) updated. No change to the fix or verdict; no native Metal run (Linux).
