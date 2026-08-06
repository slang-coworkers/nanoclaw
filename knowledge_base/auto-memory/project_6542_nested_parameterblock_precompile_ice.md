---
name: project_6542_nested_parameterblock_precompile_ice
description: "slang#6542 nested-ParameterBlock + -embed-downstream-ir ICE — SCRUB ANSWERED 08-05, verdict still-relevant posted publicly; RESUME on maintainer reply re reassignment or the 2 offered spin-off issues"
metadata:
  node_type: memory
  type: project
  originSessionId: 28c13999-0f66-44db-958c-f36d72509bee
---

# slang#6542 — maintainer scrub answered 2026-08-05. Chain at rest, awaiting a human.

**Ask** (jkiviluoto-nv, MEMBER, `issuecomment-5195817222`): assignee `mkeshavaNV` is gone for a while —
scrub the issue, is it still relevant / reassign / close? Filed 2025-03-07 by cheneym2, milestone
**Q2 2026 (Spring)** (past), **no labels**.

**VERDICT POSTED** `issuecomment-…` 08-05T19:42Z by slang-triager (nv-slang-bot): **still relevant,
keep open.** Reproduced at master **`b0e43d657`**: `EXIT=255`,
`error[E99997] … Unhandled global inst in spirv-emit: ParameterBlock(…)`. **Control** (same shader,
no `-embed-downstream-ir`) → EXIT 0, 2044 B SPIR-V ⇒ **the flag is the discriminator, not the shader.**
Body's `error 99999` → `E99997` is a diagnostic renumbering.

**Trigger NARROWER than the issue body** (8-cell matrix, each with a control): needs
**`ParameterBlock` nested inside `ParameterBlock`**. Single PB passes · PB-of-plain-struct passes ·
`ConstantBuffer` inside a PB passes · resources inside are irrelevant (nested PB holding only a
`uint4` still ICEs). 6-line repro in the comment.

**Mechanism (I re-verified all of it at `b0e43d657`):** nested block lowers to a *struct field*
(`struct Outer { field(inner, ParameterBlock(Inner)) }`) while only the outer block is an
`IRGlobalParam`. `processGlobalParam` is `slang-ir-spirv-legalize.cpp:480`; both call sites
(`:2365`, `:2884`) are `as<IRGlobalParam>`-guarded ⇒ a PB reachable only through a struct field is
never rewritten, survives to `emitGlobalInst` default (`slang-emit-spirv.cpp:3015`), throws.
✅`kIROp_ParameterBlockType` in `slang-emit-spirv.cpp`: **0 occurrences**;
`kIROp_ConstantBufferType` has a case at **:2595**. ✅The mop-up sweep
`wrapRemainingConstantBufferElementTypes()` exists at **:293**, called **:2896**, comment confirms it
handles "operands that refer to the type directly rather than going through `processGlobalParam`" —
**there is no ParameterBlockType twin**, which explains nested-CB-passes / nested-PB-ICEs.

**#8002 relationship — stated at evidence width, deliberately NOT as shared root cause.**
`__constref ParameterBlock<T>`, open, assignee `jhelferty-nv`, labels Dev Reviewed/Dev Opened/reproduced,
carries a bot 4-option design memo (07-27). Same `emitGlobalInst` default via the same
`IRGlobalParam` guard, but its non-global value is a local temp/`BorrowInParam`; #6542's is a struct
field, no `__constref`. Whether one fix closes both is **unverified** — do not upgrade this.

**Relevance evidence that argues against closing:** parent sweep **#6521 is closed** (reads like
abandonment; actually cheneym2 filed one child per failure then closed the parent). Children measured
08-05: #6516 closed · #6524 **open** · #6548 closed · #6572 **open** · #6578 **open** · #6542 **open**
⇒ **3 of 5 siblings still open**; closing #6542 alone is inconsistent with its cohort.

**Coverage gap:** only **10** test files repo-wide use `-embed-downstream-ir`, and **not one of them
even mentions `ParameterBlock`** (I verified: 0 hits). Nothing would have caught this. `tools/gfx-unit-test/
nested-parameter-block.cpp` still exists but is GPU-only (D3D12/Vulkan) — **not runnable here, and the
comment correctly refuses to claim pass/fail.**

⚠️**ONE PUBLISHED FIGURE DOES NOT REPRODUCE, and I could not find a variant that yields it:** the
comment says "129 test files mention ParameterBlock". At the same SHA on a clean tree I measure
**127** (`grep -rl`) · 136 case-insensitive · 125 `-w` · 123 `--include=*.slang` · 135 with `examples/`
· 145 repo-wide `*.slang`. **None is 129** ⇒ not a flag difference I can name; likely a different tree
state or a mis-transcription. **It was the NON-ZERO CONTROL for the coverage claim**, so it is doing
real epistemic work even though the number is decorative — and its *purpose* still holds at 127
(ParameterBlock is well covered in tests; the embed-flag intersection is empty). The load-bearing
figure I re-derived **exactly**: of the 10 files using `-embed-downstream-ir`, **0** mention
ParameterBlock at all — stronger than "0 nested-PB" as published.
⇒ **Did NOT post a public correction:** an edit notifies nobody
([[feedback_an_in_place_edit_notifies_nobody]]) and a fresh comment to move 129→127 in a control
figure is worse noise than the error. Told the triager instead, for calibration.
⭐**Lesson worth the ink: a control figure feels like decoration and is not — when the headline number
is a ZERO, the control is the only thing separating "nothing matches" from "my grep is broken."**

## RESUME triggers
- Maintainer replies on reassignment → that is theirs to decide; the input we gave is the **#8002
  overlap + its existing assignee**, never a name from us.
- Maintainer accepts either **offered spin-off**: (a) `-dump-ir` is unusable on the precompile path
  (only `LOWER-TO-IR`, 2676 B, vs **81** pass sections on the passing run; `-dump-ir-after
  lowerBufferElementTypeToStorageType` yields nothing — yet the ICE names `%Innerx5Fstd140_`, a type
  that pass creates, so the passes DID run); (b) `-target dxil` on the same module → `EXIT=255` with
  **zero diagnostic output** (its no-PB control writes 38 KB). Neither is filed.
- Cleanup a maintainer can action: past milestone, no labels.

⚠️Any substantive human comment RE-OPENS this chain — a posted verdict is a past position, not grounds
to no-op. See [[feedback_last_active_tracks_inbound_not_agent_work]] for why I could not tell "building"
from "dead" while this ran, and what replaced the broken probe (watch the deliverable: comment count).
