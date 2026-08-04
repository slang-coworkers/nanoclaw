---
name: project_12185_superseded_fix_shapes_history
description: "#12185/#12186 — the two abandoned fix shapes (E55215-in-legalization, the E39033 arc) and the escalation that replaced them"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6f619349-0ea3-4cf3-977d-4a8b6c4b3e69
---

# #12185 / PR #12186 — superseded fix shapes (history)

Split out of [[project_12185_bindless_texture_nv_desc_handle_nonimage]] to keep that file under the
24.4KB Read limit. **Nothing here is current.** The shipped shape and all live close-out checks live
in the parent's controlling block — read that first. This file exists for provenance: why the fix
looks the way it does, and which approaches were tried and dropped (so nobody re-proposes them).

The fix shape changed **~6×** across this chain. That is the single most important fact about it:
**progress echoes are not trustworthy — re-read the merged diff.**

## ⚰️ SHAPE #1 — E55215-in-legalization (07-22 → 07-23), fully superseded
Diagnosed unsupported buffer kinds via a new **`E55215`** raised in SPIR-V legalization
(`checkBindlessDescriptorHandleConversion`), AS wired producer-side. **Reached APPROVED** (pdeayton
@`4fbe216b0e`, 8 review rounds jkwak+pdeayton), including a shared
`isBindlessTextureNVEncodableResourceType` predicate that closed a `SamplerComparisonState` gap, and
pdeayton's second catch (the `OpConvertUToImageNV`-vs-`SampledImage` image/combined split).
BLOCKED-at-merge was the Falcor D3D12 flake gate, not review.

**csyonghe (project lead, 07-23 20:59Z) then proposed the producer-side restructure** — a
review-thread *comment*, not a formal REQUEST_CHANGES, but it re-opened the design. **E55215 and its
guard/predicate no longer exist in the PR** ⇒ #12191/#12192 went MOOT (both were about E55215's
dead-code / source-loc); the issue verdict cmt 5041198434 refresh was held to avoid churning through
rework.

## How option (a) was chosen and first pushed (07-23 21:21Z → 07-24 02:22Z)
- **Feasibility blocker:** "just route texture/sampler through the NV op" hit a representation wall —
  under `spvBindlessTextureNV` the handle was **uint64 capability-wide for ALL kinds** (baked into
  emit, legalization, byte-address storage, layout/reflection) while heap/AS paths decode uint2, so
  other kinds couldn't simply fall through. Framed on-thread `r3641456739` as **(a)** kind-dependent
  width vs **(b)** keep uint64 + define a uint64→heap-index encoding contract.
- **pdeayton picked (a)** (after a code-review meeting; jkwak reassigned the PR to him); impl plan
  `r3641818001`. Fix-shape-changing finding: **AS does NOT need uint64** — plain `-target spirv`
  already lowers an AS handle (uint2) → `OpConvertUToAccelerationStructureKHR` ⇒ **AS → uint2**,
  *reversing* what the then-approved PR did for AS.
- **Pushed 07-24 02:22Z** as head `f4004c3f90` (14 files +489/−70), replacing the approved diff.
  pdeayton had converted the PR to **DRAFT** @07-23 22:54:40Z; prior APPROVE dismissed. Verified at
  source: E55215 gone (0 matches, both sites); the surviving predicate **repurposed as the kind→width
  classifier** (texture/sampler=uint64, buffers/AS=uint2) feeding
  emit/legalize/byte-address/layout/reflection; buffers compile via the heap path ⇒ **abort fixed by
  construction.** Verdict refreshed via *fresh* delta cmt 5065523733 (a human had commented since ⇒
  no edit-in-place).

## pdeayton's 2 investigation Qs (07-24, cmt 5072019231) — answered, one REVERSED
- **Q1 (does the cross-width conversion assert; right layer?) = real but NARROW, NOT PR-caused.** The
  `castFloatToInt` "Unhandled global inst" abort reproduces on master **with the capability off** ⇒
  pre-existing `emitGlobalInst` gap. Only PR-new edge was a width-mismatch `SLANG_RELEASE_ASSERT`
  @`slang-emit-spirv.cpp:2855` (module-scope `static const` handle init). Principled home = SCCP, but
  SCCP folding is scalar/packed-float-gated (`sccp.cpp:1026`) so vector bit_cast can't fold today.
  **Filed as its own issue #12219** (separate chain, triager-triaged, reproduced @master).
- **Q2 (latent Std430 layout bug?) — first answer WRONG, then corrected: it WAS a real bug, fixed.**
  The initial "no bug, just wants an ABI sign-off" rested on struct-embedding tests that **MASKED**
  it; pdeayton's explicit `alignof(handle, Std430DataLayout)` query surfaced it. Root: the
  `sizeof`/`alignof` peephole ignored the **resolved layout rule** for handles ⇒ a uint2 handle
  returned natural align 4 for std430/std140 instead of 8. **Fixed in `107f158ffe`** (route the
  underlying type through resolved `layoutRules`) + regression test
  `desc-handle-layout-query-bindless-buffer.slang`; verified std430/std140=8, natural=4,
  texture(uint64)=8 all rules. ⭐**Recants are common** — the tier that had relayed the wrong answer
  upstream flagged its own reversal ([[feedback_never_relay_a_verdict_not_in_hand]]).

## ⚰️ SHAPE #2 — the E39033 arc (08-03 16:00→18:00Z), all four variants DROPPED
pdeayton asked for a rebase (master gained #12263's same-width peephole `4d8fa2e9d1`) + a **descope**
of cross-width bitcasting. In order:
1. First cut put `SLANG_UNIMPLEMENTED_X` on the descoped module-scope cross-width case.
2. **Acceptance-bar tension flagged** (#12185 says "should not abort with an internal error…") with an
   ask to *establish reachability, not rework*. Probe: the shape **IS reachable** via public
   capability-permitted constructors (both probes → E99997) ⇒ `UNIMPLEMENTED` was wrong ⇒ switched to
   a real diagnostic **`E39033`** + `DIAGNOSTIC_TEST` (cmts 5168933827, 5169049189).
   ⇒ [[feedback_descope_recheck_original_acceptance_bar]]
3. **That first E39033 was OVER-BROAD — it rejected VALID code.** It claimed `uint2` operands to
   `OpConvertUTo*NV` were invalid SPIR-V, citing a **DeepWiki summary that caveated its own
   inference**; codex challenged, and the real spec says that with `OpSamplerImageAddressingModeNV 64`
   (which Slang **always** emits) the operand may be a 64-bit scalar **or** a `uint2`. `gh-9916` was
   legitimately passing and had been *modified* to accommodate the diagnostic — **that edit was the
   tell.** Reverted `gh-9916`; narrowed E39033 to **read-back only** (empirically invalid on master:
   `OpIAdd %ulong` fed `%v2uint` → spirv-val error); added positive coverage; posted the correction
   publicly. ⇒ [[feedback_fix_can_invert_into_overrejection]]
4. **pdeayton's `isInlinableGlobalInst` proposal then superseded the whole arc** — branch reset,
   E39033 commit dropped, iteration-4 stashed, ~86 lines of cross-width machinery proven dead (0/10
   reach).

## The escalation that produced the shipped fix (08-03 17:16Z)
Rebase clean onto `0e7a383cac`; revalidation 15/15 on a focused harness (FileCheck unavailable
locally ⇒ **CI owns directive assertions**). Escalation cmts 5169375973 + correction 5169465803.

**Crux, independently confirmed at master source:** DescriptorHandle width conversions are
**capability-gated but NOT kind-gated, in BOTH directions** —
- write `hlsl.meta.slang:27474-27483`: `__init(uint2)` `[require(glsl_hlsl_spirv_wgsl,
  descriptor_handle)]`; `__init(uint64_t)` `[require(spvBindlessTextureNV, descriptor_handle)]`
- read-back `:27529-27544`: `extension uint2 { __init<T:IOpaqueDescriptor>(DescriptorHandle<T>) }`
  `[require(glsl_spirv)]`/`[require(hlsl,sm_6_6)]`/`[require(wgsl)]`; `extension uint64_t
  { __init<T>(…) }` `[require(spvBindlessTextureNV)]`/`[require(cuda)]`

Both generic over `T:IOpaqueDescriptor` with **nothing tying the chosen width to the kind's
representation** ⇒ under option-a's kind-dependent representation, "build at one width, read at the
other" is **expressible in the type system**. So emitter-side guards were genuinely **downstream
repair**, and stopping to escalate matched repo methodology ("fix the producer, don't patch the
consumer").

**Two failing consumers** (self-corrected 3→2; **function scope is FINE**):
1. module-scope read-back — master emits `OpIAdd %ulong` fed a `%v2uint` operand → spirv-val rejects
2. **descriptor-heap lowering** — `((uint2)h).x` on a uint64 emits `OpCompositeExtract %uint %ulong… 0`
   at `-O0` and **asserts in spirv-opt at `-O1`+** (`const_folding_rules.cpp:129`), **newly reachable
   via option-a** ⇒ still a candidate separate issue

**Options put to pdeayton:** (a) producer-side `T.kind` gating in `hlsl.meta.slang` — principled,
makes both sites unreachable by construction, but **PUBLIC CORE-MODULE surface** ⇒ his approval +
probably its own PR; or (b) descope + narrow module-scope E39033 and file the heap crash separately.
⭐**Escalate-don't-guess:** a fix whose principled form touches PUBLIC API surface is a maintainer
decision, not an implementation detail.

**Outcome:** pdeayton produced a *third* option — the ~10-line `isInlinableGlobalInst` addition — which
beat all four guard variants **and** the producer-side gating that had been assessed as the root fix.
The real constraint was **representation survival**, not emit-side handling. ⭐The maintainer saw a
simpler layer than either bot tier. The **kind-gating expressibility question remains open** for
pdeayton/csyonghe.
