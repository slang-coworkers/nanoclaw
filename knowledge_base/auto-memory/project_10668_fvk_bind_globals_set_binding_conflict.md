---
name: project_10668_fvk_bind_globals_set_binding_conflict
description: "#10668 -fvk-bind-globals set!=0 descriptor binding conflict — triaged+posted, awaiting maintainer greenlight for fix"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9ce31258-bb91-4c46-bc95-7d04c1f29bca
---

**shader-slang/slang#10668** — "Binding conflict when using `-fvk-bind-globals` with set != 0"

- **State (2026-07-22):** TRIAGED + REPRODUCED on ToT (build g3649fb982, source @ d384b77e6). Verified 5-bullet posted to GitHub (comment 5051542260); `reproduced` label added. Human-set Type=Bug + {Dev Reviewed, spirv_vulkan, bug} left untouched. **NO fixer dispatched** — maintainer jhelferty-nv asked only "Can you triage this?"; awaiting his greenlight before fix work.
- **Bug:** SPIR-V/Vulkan param-binding. `-fvk-bind-globals <b> <set>` with set!=0 places a resource split out of the module-scope `uniform` globals struct at the SAME (set,binding) as the `$Globals` UBO instead of binding+1 → descriptor CONFLICT. Empirical: `0 1`→both (set1,b0); `3 2`→both (set2,b3); default & `0 0`→sampler correctly bumps to b1. Trigger = the non-default-set reservation path, NOT set==1. Severity medium / P2 / no dup.
- **Recommended fix (Approach A — CORRECTED memo 09:26Z):** make split-out globals resources start at **RELATIVE descriptor offset 1** (not 0) in the global-scope aggregate, so composition with the `-fvk-bind-globals` container base yields base+1 — mirroring the default-path bump. ⚠️ **NOT an absolute binding = base+1** — that double-composes (base 3 → binding 7). Proof: `-fvk-bind-globals 3 2` gives sampler binding 3 = relative-offset-0 + container-base-3; relative-offset-1 → binding 4 (correct), absolute base+1 → 7 (wrong). Fix target = the RELATIVE offset / composition layer, reached from globals-binding setup (`slang-parameter-binding.cpp:4607-4776`) through the ScopeLayoutBuilder/type-layout composition. Fixer must IR-dump/trace the composition site (where relative offset is set + combined with container binding). Add `-target spirv-asm` FileCheck regression under tests/bindings/ — ZERO `-fvk-bind-globals` coverage today (no GPU); test SHOULD assert BOTH base 0 (sampler binding 1) AND base 3 (sampler binding 4, not 7) to guard the double-compose pitfall.
- **OPEN DESIGN POINT (do not fold into fix):** reporter mbechard asks whether split-out samplers should instead go to set 0 (DXC SPIR-V example 3). Slang's intended model = same-set/next-binding; DXC's split-to-set-0 is a SEPARATE maintainer semantics decision. Flagged on issue, held for maintainer.
- Same failure family as #11860/#11871 (single-kind exclusion guards, resource-kind-bucket mismatch). Reporter mbechard (CONTRIBUTOR); assignee/requester jhelferty-nv (MEMBER).
