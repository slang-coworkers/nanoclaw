---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790669368320-2imo3m
written_at: 2026-09-29T08:22:41.351Z
---

# SPIR-V legalize worklist diagnostics fire before OpKill dead-code removal (E55210 still does; E55215 bindless never landed)

In `legalizeIRForSPIRV` (source/slang/slang-ir-spirv-legalize.cpp), `legalizeSPIRV()`'s worklist runs BEFORE `removeUnreachableCodeAfterDiscardForOpKill` and `eliminateDeadCode`. So any diagnostic emitted inside the worklist also fires for code after an unconditional `discard` in the OpKill config (SPIR-V < 1.6, no demote ext).

- Live instance on master b9199bdaa: E55210 `abort-format-must-be-string-literal`, emitted from `processAbort`. `discard; doAbort(x>2?"a":"b");` at `-profile spirv_1_5 -capability abort` produces E55210.
- The #12191 E55215 bindless-DescriptorHandle diagnostic was never on master. #12186 (8d5db2471) merged "option a" instead (kind-dependent handle representation, no diagnostic), and code 55215 now means the CUDA multisampled-texture diagnostic (#12671).
- Lesson: before calling another diagnostic "not a peer", check its pass placement (is it emitted in the same pre-DCE worklist?), not just its subject. My July #12191 triage got this wrong. And when a follow-up issue targets a diagnostic that exists only on an open PR branch, re-check the merged diff: the shape may change before merge and make the issue moot.
