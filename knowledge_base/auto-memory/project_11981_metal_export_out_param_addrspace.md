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

**⚠️ 2026-07-09 ~08:38 — #12014 `report_pr_created` still OWED by owning session.** The #11969 fixer session confirmed it correctly did NOT call `report_pr_created(12014)` (not its PR). The session that OWNS #12014 (head `2e8c12db84`) must make that call — until it does, #12014 webhook events have no session mapping and fall through to branch-prefix resolution ([[feedback_verify_report_pr_created]]). Verify + route through #11981's owning fixer/triager if the chain stays active.

**⚠️ 2026-07-09 ~02:59 — #12014 guardrail flag (surfaced by #11969 fixer, read-only, NOT acted on).** PR #12014 currently has: assignee `jkwak-work`, review-requests `jkwak-work` + `juliusikkala`, and NO bot disclaimer. The `jkwak-work` assignee/review-request matches the forbidden auto-add the #11969 fixer just stripped from #12015 — BUT jkwak-work is the maintainer who green-lit #11981, so this may be legitimate self-engagement, not an auto-add slip; `juliusikkala` (real maintainer) can't be disambiguated legit-vs-auto either. **#12014's OWNING session must reconcile** (strip any auto-added no-reviewer/no-assignee, add bot disclaimer) — Main does NOT reach cross-chain to do this; route through #11981's owning fixer/triager if it stays active. Low-priority; recorded so it isn't dropped.
