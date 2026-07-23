---
name: project_10584_svbarycentric_capability_check
description: "slang#10584 SV_Barycentrics missing fragmentshaderbarycentric capability check — triaged/parked; human draft"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1ec77e7d-0b24-47cf-9691-8d55a647b40c
---

slang#10584: `SV_Barycentrics` emits `OpCapability FragmentBarycentricKHR` + `SPV_KHR_fragment_shader_barycentric`, but its `core.meta.slang:5374` decl only requires stage atom `[require(fragment)]`, never the feature atom `fragmentshaderbarycentric` → profile-upgrade warning 41012 (`profile-implicitly-upgraded`) never fires. bug (missing diagnostic) / low / P2. REPRODUCED on ToT (0 diagnostics under `-profile spirv_1_6` and `spirv_1_3`). Not a dup.

**State: TRIAGED + PARKED (07-18).** jkwak-work asked only "can you triage this?" — triage + 5-bullet verdict posted (comment 5011388106); `reproduced` label applied. Main authorized option (a): verdict-on-issue only, **no fixer dispatched**.

**Why no fixer:** assignee @jhelferty-nv (human CONTRIBUTOR) already owns **draft PR #10666** (`Fixes #10584`) implementing the correct fix (adds require + propagation for direct-param & struct-field cases + diag test). Stalled: CI red on `test-slang` (linux/macos/windows-gpu) + `check-ci`, unaddressed coderabbit/claude-review, last touched 2026-05-05 — likely new requirement trips existing barycentric tests. Dispatching slang-fixer would create a competing PR against a live human draft → held per [[feedback_drafts_only_guardrail]].

**If re-pinged:** don't re-triage, don't open competing fix. Options if maintainer escalates: (b) authorize fixer to *unblock #10666* only (green CI / address review), or (c) ping @jhelferty-nv.

**🔄 TAKEOVER → bot PR #12194 (07-23 02:35, fixer msg 57332; canonical thread `gh-issue-shader-slang/slang-10666`).** The stalled human draft #10666 was taken over by the bot (maintainer-directed — Main wasn't looped on the dispatch itself; webhook-originated to the fixer session). New PR **#12194** "SV_Barycentrics takeover", draft, head **`ca314db538`**. **slang-reviewer 3-reviewer pass → APPROVE_WITH_NITS** (0 bugs; 3 doc/test-coverage gaps; no correctness/memory/cross-backend/capability defect across 6 reviewer agents + independent trace). Fixer applied all 3 nits + a profile-parity nit: restored a corrected doc comment on the dual-purpose recursive validator, reworded the collector comment, added a type-mismatch test (int : SV_Barycentrics → only the type error, NO spurious capability upgrade), aligned the negative-case profile. **Declined one advisory** (removing defensive null/Invalid-stage guards) — coderabbit had explicitly REQUESTED that null guard on the original #10666, so removing it would undo prior review. Verify: focused 6/6, full diagnostics 708/708; codex PLAN/CODE/OUTPUT approve. Draft CI red = benign priority-yield. **Held draft — ready-flip + close-#10584/#10666 stay with jhelferty (drafts-only guardrail).** Webhook-driven to the fixer session. Await maintainer review → ready-flip → merge. NOTE: the old #10666 human draft is presumably superseded by #12194; verify #10666's disposition (close/superseded) when #12194 lands. Do NOT relay "approved" — it's APPROVE_WITH_NITS peer (shadow), not a maintainer approval yet.
