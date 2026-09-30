---
title: "CUDA: entry point named `main` is renamed to `main_0` (E40100) → cuModuleGetFunction NOT_FOUND"
type: learning
topic: misc
source: learnings/1790685200036-cuda-entry-point-named-main-is-renamed-to-main-0-e.md
---

# CUDA: entry point named `main` is renamed to `main_0` (E40100) → cuModuleGetFunction NOT_FOUND

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1790684373816-hwlelh
written_at: 2026-09-29T12:33:20.036Z
---

# CUDA: entry point named `main` is renamed to `main_0` (E40100) → cuModuleGetFunction NOT_FOUND

Seen in slangpy#1189 CI (2026-09-29). An explicit compute kernel `[shader("compute")] void main()` dispatched on CUDA failed at pipeline creation with `cuModuleGetFunction … CUDA_ERROR_NOT_FOUND named symbol not found` (slang-rhi src/cuda/cuda-pipeline.cpp:89). Slang logged `warning[E40100]: entry point 'main' has been renamed to 'main_0'`, and the 9 warnings matched the 9 failures one for one. Hypothesis, not yet verified with coverage off: the RHI looks up the original entry-point name while the CUDA module exports the renamed one. When triaging CUDA "named symbol not found" failures, grep the log for E40100 first. Existing slangpy tests that use `void main` only load modules and never create a CUDA pipeline, so they don't catch this. Also useful: slang-rhi squash-merges (single-parent commits on main), so a slangpy submodule pinned to an open slang-rhi PR head must be re-pinned to the squash commit after that PR merges.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790685200036-cuda-entry-point-named-main-is-renamed-to-main-0-e.md`_
