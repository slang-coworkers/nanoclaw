---
type: chain
title: "slang#14652 — SPIR-V ByteAddressBuffer.Load<float2> validation failure with descriptor-heap BAB"
description: Fixed via call-specialization of heap-fetch args (draft PR #14654); parked on pdeayton-nv's mixed-signature decision
tags: [slang, spirv, byte-address-buffer, descriptor-heap, call-specialization]
---

# slang#14652 — SPIR-V `ByteAddressBuffer.Load<float2>` fails validation with descriptor-heap BAB

**⭐ TERMINAL 11-21 01:14Z: PR #14654 MERGED** (merge commit `41541c017`, pdeayton-nv; issue
auto-closed `completed` at 01:14:08Z, Main-live-verified). E2E ~23.5 h filed→merged. Worktree +
sentinel reaped by the fixer; fixer landed a shared learning (the -emit-spirv-directly-defaults-true
trap two reviewers hit). Full arc: consumer-side attempt (superseded) → maintainer-directed
producer-side rework in call specialization → option-(a) widening → 3 peer rounds (R3
APPROVE_WITH_NITS all applied) → maintainer APPROVED (5998201699) + human ready-flip → merged.

HUMAN-filed 11-20 01:39Z by **pdeayton-nv** (R6 dispatch at once; 👀 reaction 672533123; canonical
thread `gh-issue-shader-slang/slang-14652`). Issue: repro = global BAB `Load<float2>` + a
`ResourceDescriptorHeap`-sourced BAB passed to a helper — together they emit a type-mismatched
`OpAccessChain` (`%float` result indexed into `%uint` base) failing spirv-val; either part alone is valid.

## Triage (triager, 01:53Z — Main-relayed, memo received)
bug/medium/P2, **reproduced on master** (rebuilt slangc); issue 5-bullet cmt **7027913427**; labels
`reproduced` + Issue Type Bug. Root cause: byte-address legalization's function-param path does
`replaceUsesWith` on the module-wide deduped `HLSLByteAddressBufferType` inst
(`slang-ir-byte-address-legalize.cpp:1475`), retyping every BAB to the first-legalized element type;
the kind-only early-out at `:1387` then feeds the poisoned global to the `Load<float2>` lowering.
Heap args are the trigger only because they defeat `specializeFuncsForBufferLoadArgs`
(`slang-emit.cpp:2239`) — verified by variant matrix + before/after IR dumps.

## Fix chain (slang-fixer, draft PR #14654)
"Specialize descriptor-heap fetch arguments into callees" — branch `fix/issue-14652`,
`pr: non-breaking`. **Journey: consumer-side fix first (early-outs at :1387/:1610) → maintainer
rework direction** (pdeayton-nv PR cmt 7030922527) **→ final approach = call specialization**:
a BAB-typed `SPIRVLoadDescriptorFromHeap` arg is traced through the specialization walker like an
element access (`getHeap()` to the module-scope resource-heap leaf, one clone per callee/heap/
index-type) so the fetch moves into the specialized callee and no BAB param survives into
byte-address legalization. Net diff = 1 compiler file + 1 test file; consumer-side approach
committed-then-reverted as reviewable steps. 13 commits at head **`fa03fa2a6`** (live-verified
draft 08:2xZ). Four maintainer inline asks all met (as<> cast, getHeap() accessor, sampler-heap
arms dropped ×3 checks, mixed-sig documentation; heads 8650395 → d4e7e9 → fa03fa2a).

## Review state
2 peer rounds. R1 REQUEST_CHANGES on the superseded consumer-side head. R2 REQUEST_CHANGES with
**one confirmed gap**: a call mixing a heap-fetched Texture2D with a heap-fetched BAB still fails
spirv-val (exact #14652 error; pre-existing on master; reviewer repro + control verified). Per the
two-round rule the fixer shipped the better diff rather than widening the gate (ungated version
reshapes tests/bugs/13074's pinned texture threading — empirically shown): limitation documented at
the gate (ad37e961f), options posted to pdeayton-nv (PR cmt **7033648017**: widen with 13074
renegotiation, or follow-up issue). Repro/control ready as follow-up material (fixer scratch
`scratch-14652/mixed-sig-*.slang`). All clarity findings applied; all critique stages approve.
Reviewer's [Resolution] 08:14Z accepted the disposition — review chain closed, parked on the
maintainer's call.

**Addendum (fixer, 08:24Z) — required content when triage files the follow-up issue (option b):**
1. The issue body must pin the full command line — the mixed-sig repro only fails WITH
   `-capability spvDescriptorHeapEXT`
   (`slangc -target spirv -entry main -stage compute -capability spvDescriptorHeapEXT -validate-with-downstream-compiler mixed-sig-repro.slang`;
   without the flag it validates clean).
2. The two open threads are one decision: option (a) per-param extension makes the heap-BAB param
   path genuinely unreachable (old Bug-2 guard stays master-latent follow-up material); option (b)
   documentation requires a fail-loud guard in byte-address legalization's IRParam branch
   (`as<IRByteAddressBufferTypeBase>(unwrapArray(babType))` → bail) so the documented shape fails
   with a diagnosable error instead of a silent miscompile — that guard ask belongs in the
   follow-up issue. Repro/control: fixer scratch `mixed-sig-*.slang`. In-PR widening would reopen
   a slang-reviewer round.

## Tests
Repro + maintainer two-helper case + all variants fail pre-fix / pass at head; tests/spirv
**1014/1014**; unit 688/688; byte-address/descriptor-handle/bugs/metal/wgsl/cuda/cooperative green
(3 fp8-cuda pre-existing on master); tests/bugs/13074 115/115.

## State: TERMINAL — MERGED 11-21 01:14Z
- History: 3 peer review rounds complete (R3 APPROVE_WITH_NITS all applied); maintainer drove the
  design (rework direction, option-(a) widening, 6 inline asks met). No follow-up issue
  (mixed-signature gap fixed in-PR). Post-merge: fixer reaps wt-slang-14652 + sentinel per its
  workflow. Related: #13074, #14646.
