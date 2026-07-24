---
name: project_12185_bindless_texture_nv_desc_handle_nonimage
description: "#12185 spvBindlessTextureNV aborts on non-image/sampler DescriptorHandle — triaged P2, fixer handoff"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6f619349-0ea3-4cf3-977d-4a8b6c4b3e69
---

# #12185 — spvBindlessTextureNV InternalError for non-texture/sampler DescriptorHandle

**Repo:** shader-slang/slang · **Author:** pdeayton-nv (MEMBER) · opened 2026-07-22
**Canonical thread:** `gh-issue-shader-slang/slang-12185`

With `-capability spvBindlessTextureNV`, converting `DescriptorHandle<T>` → SPIR-V aborts
(`E99997 InternalError: Unsupported result type for CastDescriptorHandleToResource`, exit 255)
for ConstantBuffer / StructuredBuffer / RWStructuredBuffer / ByteAddressBuffer **and**
RaytracingAccelerationStructure. Image/sampler kinds compile fine. Same cases compile without
the capability.

## Root cause (triager-verified at source @d148787f2)
Producer/consumer breadth mismatch:
- **Producer** `hlsl.meta.slang:27784-27785` — the `case spvBindlessTextureNV:` arm forwards
  *every* descriptor kind through `__castDescriptorHandleToResource<T>` **unconditionally**
  (sibling arms all `switch(T.kind)`).
- **Consumer** `slang-emit-spirv.cpp:5121-5147` — only handles `TextureType`/`SamplerStateType`;
  `default → SLANG_UNEXPECTED` at 5145.
- `SPV_NV_bindless_texture` defines uint→image/sampler only; buffers have no encoding (→ should
  be a graceful diagnostic); AS has `OpConvertUToAccelerationStructureKHR` (already used at
  slang-emit-spirv ~7490-7497 but not wired into this path).

## Correction to reporter analysis
Reporter said AS *should* work; in fact R3/AS **also aborts** currently.

## Fix as landed (draft PR #12186)
Triager sketched Approach A (meta.slang static_assert). **Fixer chose a different, sound layer:**
buffer-diagnostic landed in **SPIR-V legalization** — new `E55215` via
`checkBindlessDescriptorHandleConversion` (op occurs at local+global scope; legalization visits
all before emit; mirrors existing `TargetDoesNotSupportDescriptorHandle`). **AS wired
producer-side now** (open design Q resolved = wire now, not defer) → emits
`OpConvertUToAccelerationStructureKHR`, passes spirv-val.

Result: all 4 reporter repros no longer abort. AS → valid SPIR-V; ConstantBuffer/StructuredBuffer
→ clean `E55215`, zero `E99997`; image/sampler + texel-buffer controls unchanged. Repro test
`tests/language-feature/descriptor-handle/desc-handle-nv-bindless-texture-kinds.slang`.

## Chain state (as of 2026-07-23 ~21:05Z) — RE-OPENED for project-lead redesign
- **csyonghe (Yong He, project lead) posted a redesign proposal @20:59Z** on the unresolved
  `hlsl.meta.slang` review thread. GitHub reviewDecision STILL `APPROVED` (head `4fbe216b0e`,
  MERGEABLE) — csyonghe posted a review-thread *comment*, NOT a formal REQUEST_CHANGES — but
  substantively this **re-opens the design** (supersedes prior "held on merge").
- **Proposal:** delete the dedicated `spvBindlessTextureNV` target-switch arm; instead special-case
  `T.kind == Texture/Sampler/CombinedTextureSampler` inside the `spvDescriptorHeapEXT` + default
  arms — so the NV conversion opcode fires only for texture/sampler kinds AND only when the
  capability is set, with defined behavior when bindless-texture is/isn't combined with
  DescriptorHeapEXT. "Fix-the-producer, don't diagnose-downstream" restructure (repo methodology)
  → would supersede the current E55215-in-legalization shape.
- **Ownership:** slang-fixer (PR owner) investigating feasibility (can `.meta.slang` branch on the
  sub-capability; is the non-DescriptorHeapEXT buffer path well-defined) and will reply on-thread
  with a concrete direction BEFORE touching code (implementing would dismiss pdeayton's approval).
  Triager NOT running parallel analysis — fixer's surface. Design call = csyonghe + fixer +
  pdeayton, NOT orchestrator to dispatch.
- **Issue verdict (cmt 5041198434):** HOLDING refresh — still reads "APPROVED, awaiting merge"
  (soft now); triager won't churn until redesign direction settles.
- **Now held on: design-settle → rework → re-approve → merge** (not merge). Triager relays the
  fixer's direction when it lands.

### Fixer feasibility (2026-07-23 ~21:21Z) — NOT a simple rework; blocker found
- csyonghe's proposal (route only texture/sampler through NV op, drop E55215) is the cleaner
  producer-side direction BUT hits a **representation blocker:** under `spvBindlessTextureNV` the
  `DescriptorHandle` is **uint64 capability-wide for ALL kinds** (baked into emit, legalization,
  byte-address storage, layout/reflection), while heap/AS paths decode uint2 → non-texture/sampler
  kinds can't just fall through.
- **Decision now with project lead csyonghe** (framed on-thread `r3641456739`):
  (a) make handle width kind-dependent → cross-subsystem audit (potentially large), vs
  (b) keep uint64-wide + define a uint64→heap-index encoding contract.
  Fixer holding for csyonghe's (a)/(b) pick; will implement his choice + re-verify (WILL dismiss
  pdeayton's approval — expected for a real code change). Fixer won't implement speculatively
  (holds if csyonghe goes quiet).
- **Scope/risk up:** previously-"clean approved fix" may now need non-trivial redesign; chain
  duration/risk increased. GitHub reviewDecision still APPROVED but effectively superseded.
- **Held on csyonghe's design decision** — no human action needed except the lead's call.

### Design decision LANDED (2026-07-23 ~22:37Z): option (a), kind-dependent handle width
- Per a code-review meeting, jkwak reassigned PR #12186 to **pdeayton-nv** (assignees=[pdeayton-nv],
  head still `4fbe216b0e`, reviewDecision still APPROVED — no code pushed yet). pdeayton picked
  **option (a):** make DescriptorHandle SPIR-V representation **kind-dependent** (uint64 only for
  `spvBindlessTextureNV`-affected kinds, uint2 otherwise). Fixer posted impl plan on-thread
  `r3641818001`.
- **Fix-shape-changing finding:** acceleration structures do NOT need uint64 — plain `-target
  spirv` already lowers an AS handle (uint2) → `OpConvertUToAccelerationStructureKHR` (spirv arm
  packs `__asuint64((uint2))` itself). So **AS → uint2**, falling through the existing path —
  which *reverses* what the currently-approved PR does for AS. Fixer verified empirically
  (corrected a subagent). (Analysis on fixer's own PR code; triager did not re-derive.)
- **Scope = representation-wide:** one kind→width classifier (single source of truth, IR+AST)
  feeding the ~6 sites that today decide uint64 capability-wide (emit, legalization,
  layout/reflection); branch `.meta.slang` casts on `T.kind`; **DELETE the standalone NV arm + the
  E55215 diagnostic/guard/predicate.** Supersedes the entire current fix shape → will dismiss
  pdeayton's approval + re-request review (expected).
- **Held on pdeayton confirming two mapping points** — kind→width (esp. AS→uint2) and whether CUDA
  stays uint64-wide — BEFORE fixer builds. Fixer won't implement on unconfirmed mapping; holds if
  pdeayton goes quiet. Next: confirm mapping → implement representation change → re-verify → new
  review cycle. Verdict (cmt 5041198434) refresh still HELD.

### Option (a) redesign PUSHED (2026-07-24 ~02:22Z) — PR back in DRAFT, held on re-review
- **Previously-approved diff REPLACED** with the kind-dependent representation. Verified head
  `f4004c3f90`, `Closes #12185`, **14 files +489/−70**.
- **PR is DRAFT** (pdeayton-nv converted it @07-23 22:54:40Z, verified via timeline);
  reviewDecision=REVIEW_REQUIRED, prior APPROVE dismissed. **Draft-hold guardrail applies — issue
  is the public surface.**
- **Substance verified (triager, at source):** E55215 genuinely GONE (diagnostics.lua def +
  legalize guard both 0 matches). Surviving `isBindlessTextureNVEncodableResourceType` repurposed
  as the **kind→width classifier** (texture/sampler family=uint64, buffers/AS=uint2), feeding
  emit/legalize/byte-address/layout/reflection. Buffers now compile via the heap path — **abort
  fixed BY CONSTRUCTION, not diagnosed.** AS→uint2 as predicted.
- **GitHub:** issue verdict refreshed via **fresh incremental delta cmt 5065523733** (a human
  jkwak commented since last, so posted new comment rather than editing buried "approved" one):
  "approach reworked, PR back in draft for re-review, E55215 removed". Nothing re-flipped.
- **#12191/#12192 likely MOOT** under this design (they were about the removed E55215's
  dead-code/source-loc); fixer will close once this lands unless maintainers keep them; triager
  re-triages if a substantive human cmt lands on either.
- Fixer verified full kind matrix GPU-less + codex green (rounds→44).
- **Held on maintainer re-review + CI on reworked draft → re-approve → human flips ready → merge.**

### Superseded (was, 2026-07-23 ~13:36Z): APPROVED/held-on-merge
- PR #12186 was APPROVED@`4fbe216b0e` (pdeayton-nv, binds current head, verified not stale),
  MERGEABLE after 8 review rounds (jkwak + pdeayton). BLOCKED = Falcor D3D12 flake gate, not review.
  pdeayton's 2 correctness catches folded: (a) SamplerComparisonState, (b) OpConvertUToImageNV-vs-
  SampledImage image/combined split. csyonghe's redesign may restructure all of this.

- Classified bug / medium / **P2** / SPIR-V emit. Issue Type `Bug`; `reproduced` applied.
- **PR #12186 — NON-DRAFT / ready-for-review.** jkwak-work flipped draft→ready @15:54:57Z
  (ReadyForReviewEvent; isDraft=false, reviewDecision=REVIEW_REQUIRED, jkwak COMMENTED not
  approved). `Closes #12185`, branch `fix/issue-12185`, `pr: non-breaking`. **Now the public
  artifact carrying the trail.**
- **Round-3 (jkwak's 8 inline comments) folded in @ head `ec7d8d83f6`** (was `5c0694b537`):
  5 mechanical (comment removals/revert + rename `diagnose…`→`maybeDiagnose…`) + 2 on-thread
  answers (findOuterGeneric generic-skip; predicate is a type-classifier not an NV-ext detector)
  + **1 OPEN pushback:** fixer DECLINED jkwak's `SLANG_ASSERT(getErrorCount()==0)` because
  legalization legitimately raises E55215 (count deliberately non-zero), citing existing
  `if(getErrorCount()!=0) return SLANG_FAIL` precedent — **left as jkwak's call**. Also jkwak
  offered a `isTextureOrSamplerStateType` rename. No logic changed round-3 (comments+rename only).
- **Rounds 3–7 (maintainer review jkwak + pdeayton) CLOSED @ HEAD `b0167a5c3a`** — all resolved
  or agreed-deferred; fixer stood down pending APPROVE. pdeayton's 2 correctness catches folded:
  (a) SamplerComparisonState, (b) OpConvertUToImageNV-vs-SampledImage image/combined split.
  Early-vs-late diagnostic placement settled = legalization-worklist case. Final push was a
  behavior-identical nit (`as<IRTextureType>` in the shared predicate). `reviewDecision=
  REVIEW_REQUIRED` (no APPROVE yet).
- **2 agreed-deferred follow-ups filed (separate cleanup, bot-authored, NOT folded into this
  chain):** **#12191** (E55215 diagnosed in post-OpKill dead code) + **#12192** (ConstantBuffer
  E55215 lacks a valid source location). Will surface as their own triage inbounds if routed.
- CI on fresh head green-so-far (some pending); only red across cycle = documented Falcor D3D12
  GBuffer-RT flake, unreachable from SPIR-V-only diff — not a regression.
- Verified locally (6 variants pass GPU-less w/ spirv-val, desc-handle suite 5/5, buffer arms
  assert E55215 + zero E99997); codex CODE+OUTPUT approve. Real `pull_request` CI run 29937049157
  queued. **CI-red webhook = cosmetic priority-yield** (redundant workflow_dispatch; builds/tests
  SKIPPED, only check-ci/wait-for-human-priority red) — NOT a failure. Also known: D3D12 Falcor
  `test_GBufferRTTexGrads_d3d12` image flake, blast-radius-cleared (SPIR-V-only change).
- **All 4 reviewer items folded in & re-verified by triager at source (head 5c0694b537):**
  Gap #1 fixed via shared `isBindlessTextureNVEncodableResourceType` predicate in slang-ir-util
  (`unwrapAttributedType` → `kIROp_TextureType || as<IRSamplerStateTypeBase>`) used by BOTH the
  legalize guard AND the emit switch (single source of truth; emit adds
  `case kIROp_SamplerComparisonStateType → OpConvertUToSamplerNV`) — also closes the C001 latent
  AttributedType-unwrap re-abort. `SamplerComparisonStateType` confirmed nested under
  `SamplerStateTypeBase` in slang-ir-insts.lua so predicate genuinely accepts it. #2 message adds
  texel buffers / no over-claim; #3 SAMPLER_COMPARISON + BYTE_ADDRESS_BUFFER test arms +
  `CHECK-NOT: E99997` on all buffer arms; #4 shared-predicate rename + comment. codex approve.
- Issue verdict (cmt 5041198434) refreshed in place → "reviewed clean, ready-for-review, in
  maintainer review".
- codex PLAN+CODE+OUTPUT approve; [Fix Review Request] → slang-reviewer.
- **Reviewer verdict (2026-07-22, head 3e5cccb28e / diff ea76331334b2): `APPROVE_WITH_NITS`** —
  0 bugs, 3 gaps, 1 clarity. Advisory, 0 GitHub writes. A (correctness) + C (clarity) completed;
  B (Devin) timed out → skipped. Gaps to fold in while draft:
  1. **[correctness completeness] slang-ir-spirv-legalize.cpp:1860** — allow-list accepts only
     `kIROp_TextureType`/`kIROp_SamplerStateType`; `SamplerComparisonState`
     (`kIROp_SamplerComparisonStateType`, `DescriptorKind.Sampler` @meta.slang:27401, encodable
     via `OpConvertUToSamplerNV`) is falsely diagnosed E55215 → PR turns old abort into a *wrong
     diagnostic*. Fix: widen guard to `as<IRSamplerStateTypeBase>` + add case to emit switch
     (mirror emit:2746); also verify `CombinedTextureSampler`.
  2. **slang-diagnostics.lua:5628** — E55215 message omits texel buffers, lists "samplers" while
     rejecting comparison sampler. Align after #1.
  3. **test** — no `ByteAddressBuffer.Handle` arm (distinct `translateToStructuredBufferOps` path;
     untested). Add `-DBYTE_ADDRESS_BUFFER` asserting E55215.
  4. **[clarity C001, latent]** accept-set hand-duplicated vs emitter; guard unwraps
     `AttributedType`, emitter doesn't (latent re-abort) → factor shared predicate
     `isBindlessTextureNVEncodableResultType`.
- Relayed to slang-triager on canonical thread + full `combined-review.md` attached; triager
  forwards to slang-fixer for PR update.
- **Next human action:** review draft, flip ready, merge. Close-out when #12186 merges.
- Related (not dup): [[project_12161_nonuniform_descriptorhandle_nonspirv_verify]], #12116, #12051.
