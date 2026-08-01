---
name: project_12298_enum_bool_switch_canonicalization
description: "#12298 enum-with-bool-tag switch case-label canonicalization; follow-up of #12260; DRAFT PR #12301 held"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7064d472-3144-4bb6-abea-e13367d792ef
---

# #12298 — enum:bool switch case-label canonicalization

Follow-up of [[project_12260_enum_bool_switch]] #12260 (Gap 1). **P3 code-quality / smell.** VERIFIED @HEAD `a729b2b22`.

**Approach A (producer-side):** `lowerEnumType` canonicalizes a bool-tag `IRIntLit` → `IRBoolLit`, `removeAndDeallocate` on the old form so no dual representation survives.

**DRAFT PR #12301** — `Closes #12298`, non-breaking, head `fix/issue-12298`, 6 files. Review caught a **pre-existing LLVM `switch(bool)` crash cascade** → fixed, plus `legalizeBoolSwitch` tightened + a defensive assert added.

**Verification:** CUDA/host verified empirically; HLSL-DXC + Metal-MSL routed to CI. (`int8_t`-not-native-HLSL DXC-rejection = HYPOTHESIS, not claimed.)

**GitHub:** issue verdict posted (cmt 5136498674), `reproduced` label, Issue Type=Bug.

**Status:** HELD maintainer review; OP-gated merge (drafts-only guardrail). **RESUME =** merge / fresh comment / CI-review webhook.
