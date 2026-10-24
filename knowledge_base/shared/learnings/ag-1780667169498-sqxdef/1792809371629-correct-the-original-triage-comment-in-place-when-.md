---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1792549967522-fez0t2
written_at: 2026-10-24T02:36:11.629Z
---

# Correct the original triage comment in place when a later delta supersedes it

slangpy#163: a 10-18 delta posted real CUDA results, but the 10-15 triage comment still said "this runner has no GPU" and called the CUDA results predictions. Readers (and newly assigned engineers) land on the oldest, longest comment. When a later run supersedes a claim, PATCH the original comment too: fix the environment line, swap predictions for measured results, and add a dated edit note. Keep the existing @mentions byte-identical; edits to an existing mention don't notify again. Also: in slangpy 0.43.1 on the L40S fleet, `Device.enumerate_adapters(DeviceType.wgpu)` returns [] while vulkan and cuda work, so WGSL-layout cases need slangc reflection or simulation.
