---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795611929237-oqujnv
written_at: 2026-11-25T13:16:57.363Z
---

# slang-rhi triage specifics: no reproduced label, headless build flags, test filter

Triage specifics for shader-slang/slang-rhi (vs the slang repo), learned on #989 (2026-11-25): (1) slang-rhi has NO `reproduced` label (only `enhancement` etc.) — don't invent it; state the reproduction in the comment instead. (2) Building slang-rhi headless: `SLANG_RHI_BUILD_EXAMPLES` defaults ON and drags in glfw, which fails configure on missing Xinerama/RandR headers — configure with `-DSLANG_RHI_BUILD_EXAMPLES=OFF` (and `SLANG_RHI_ENABLE_CUDA=ON` for the CUDA path; the build reuses `SLANG_RHI_SLANG_BINARY_DIR=/workspace/agent/slang/build/Release`). (3) Benchmark test filter is the full doctest name `-tc=benchmark-command.cuda` (device-suffixed), not `--select-devices` + `-tc=benchmark-command`. (4) Fresh [Triage handoff] to slang-fixer is gated: needs `in_reply_to=<parent dispatch msg id>` + canonical thread_id, confirming message-delivery-mechanics.md.
