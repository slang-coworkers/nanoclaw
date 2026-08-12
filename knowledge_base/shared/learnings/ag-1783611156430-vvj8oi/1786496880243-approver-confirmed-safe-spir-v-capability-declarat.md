---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786491345130-nkin9y
written_at: 2026-08-12T01:08:00.243Z
---

# [approver/confirmed-safe] SPIR-V capability-declaration completeness fixes (decoration requires a cap the module didn't declare) are a low-risk shape

**Confirmed safe (join):** slang #12467 — WOULD_APPROVE, MERGED at the exact decided head by a human maintainer (jvepsalainen-nv), single-commit PR, zero interval commits, and the same human had explicitly APPROVED "LGTM" at that head. Clean agreement, no follow-up churn.

**The class of change:** a target emitter emits a decoration/instruction whose spec entry requires a capability the module never declared, so the output fails validation (here `OpDecorate ... Sample` requires `SampleRateShading`, but only `OpCapability Shader` was declared → spirv-val rejects). The fix declares the missing capability at the emit site via the established funnel (`requireSPIRVCapability(...)`), which is idempotent.

**Why this shape is low-risk, and the cheap probes that establish it (all passed here):**
1. **Additive-only.** Declaring a capability can only ADD an `OpCapability` line; it cannot change or remove existing emitted code, so it cannot regress a byte-identical codegen expectation. (Devin itself noted this as an "Informational".)
2. **Established funnel + spec pairing.** Confirm the exact decoration→capability pairing against `external/spirv-headers/.../spirv.core.grammar.json` (`capabilities` field per enumerant), and that the call matches sibling sites in the same emitter. If both hold, the fix is convention, not invention.
3. **Single emit site.** `grep` the decoration's Spv* name — one hit means no sibling path needs the same treatment.
4. **The regression test must be a positive control**, not vacuous: for capability tests, the shader must NOT use any system value / feature that self-declares the same capability (e.g. SV_SampleIndex/SV_VulkanSamplePosition self-declare SampleRateShading, so a test using them passes even unfixed). Use a `-target spirv` (binary) directive so `SLANG_RUN_SPIRV_VALIDATION=1` validates, not just a string check.

**Transferable takeaway for Step-0 recall:** capability-declaration-completeness fixes in `slang-emit-spirv.cpp` (and analogous per-target header emitters) that are additive, spec-matched, single-site, and carry a non-vacuous positive-control test are a WOULD_APPROVE-appropriate shape — the merge outcome confirmed it. The real diligence is on the TEST design and any suppression-list edits, not the one-line emitter change. (See sibling learnings on the empty-Devin-flags false-clean and the fail-fast whole-module validation proof, which is where the actual scrutiny went.)
