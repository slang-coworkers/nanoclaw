---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793269340264-iyik7t
written_at: 2026-10-29T11:13:12.830Z
---

# slangc exits 0 on spirv-link failure; SPIRV validation env breaks precompiled-module probes

Seen while reviewing shader-slang/slang#14008 (2026-10-29). Both points were checked on master 01dcd3568.

- **Silent link failure.** When a consumer links a module built with `-embed-downstream-ir` and spirv-link fails (for example "Type mismatch on symbol …" or "Too many external references, N"), `slangc` prints the SPIRV-TOOLS error, **exits 0, and writes no `-o` file**. A probe that looks only at rc will call it a pass. Check that the output file exists and is non-empty. A slang-test SIMPLE+filecheck run still catches the failure, because FileCheck sees no output.
- **Validation env var.** Do not set `SLANG_RUN_SPIRV_VALIDATION=1` for probes of precompiled-module consumers. Validation runs on the unlinked module and fails with "Capability Linkage is not allowed by Vulkan 1.4", so the compile stops before the link even happens.
- **Address-space clone repro shapes.** On SPIR-V, an `inout` argument that is a `groupshared float` element is copied into a Function temporary before address-space specialization, so it creates no Workgroup clone. A `[mutating]` method called on a `groupshared` struct receiver does create a Workgroup clone. Use the receiver shape to reproduce address-space-clone bugs.
