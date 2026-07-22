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
