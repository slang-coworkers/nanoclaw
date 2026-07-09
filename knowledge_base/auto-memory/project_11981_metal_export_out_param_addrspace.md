---
name: project_11981_metal_export_out_param_addrspace
description: "In-flight — Metal export/library out/inout param crashes 'Unknown addressspace encountered'; sibling of"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1290ecd4-25ec-456d-b180-846a8c8d1c62
---

**shader-slang/slang#11981** — Metal: an `export`/public-linkage function with a mutable-ref (`out`/`inout`) param reaches Metal emission as a pointer with `AddressSpace::Generic`; emitter's addr-space switch (`slang-emit-metal.cpp:1363`) has no case → `SLANG_UNEXPECTED` "Unknown addressspace encountered".

Triager verified at HEAD 33f9ed0ce (no GPU). **Corrected the bot's own claim:** true trigger is `export` linkage on a mutable-ref param — crashes WITH or WITHOUT an entry point and WITH or WITHOUT `-whole-program` (bot's "no crash when entry point present" was INCOMPLETE). WGSL + GLSL + HLSL emit the repro cleanly → Metal-specific.

Confirmed **sibling-not-dup of [[project_11969_metal_out_param_addrspace]]** (#11969): same emitter default-arm symptom, DIFFERENT producer — #11969 is the vertex-only stage gate in `legalizeEntryPointVaryingParamsForMetal`; #11981's producer is `AddressSpaceContext::processModule()` (`slang-ir-specialize-address-space.cpp:359`) seeding its worklist only from `IREntryPointDecoration` funcs. Neither fix subsumes the other.

Recommended fix = Approach A (producer-side): seed HLSLExport/Public funcs in `processModule` + default unspecialized mutable-ref params to `thread` (`AddressSpace::ThreadLocal`).

**State (updated 2026-07-09):** DRAFT PR **#12014** opened — https://github.com/shader-slang/slang/pull/12014 — per maintainer jkwak-work green-light ("make a PR with 'producer-side fix'"). Approach A shipped: new `getDefaultAddressSpaceForExportedFunctionParam` virtual (base=`Generic`, Metal=`ThreadLocal`); `processModule` split-concern seeding of exported funcs; `tests/metal/export-out-param.slang` added. 4 files, +211. Non-Metal byte-identical by construction. `slang-test` export-out-param + out-param regression both PASS; codex gate all-green (PLAN/CODE/OUTPUT); dispatched to slang-reviewer. CI red on draft = priority-yield cosmetic (wait-for-human-priority + check-ci only; builds skipped) — NOT a real failure; real pull_request CI fires on maintainer ready-flip.

**Held pending maintainer review/ready-flip — bot does NOT flip ready or merge (gated).** Draft-held rule: `Closes #11981` in a draft doesn't surface, so triager tasked (msg157) to post the "triaged → fix in draft PR #12014, held" 5-bullet on the issue for public footprint, and to confirm the fixer called `report_pr_created(12014)`. Peer-wired triager→fixer; do NOT double-dispatch. Was: triage done, comment PATCHED, awaiting [Fix Report] — now [Fix Report] received. Classification: bug / medium / P2.
