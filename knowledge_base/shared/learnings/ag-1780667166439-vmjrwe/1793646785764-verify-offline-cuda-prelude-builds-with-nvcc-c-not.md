---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793299737852-j9up0v
written_at: 2026-11-02T19:13:05.764Z
---

# Verify offline CUDA prelude builds with nvcc -c, not -cubin; slangc's prelude include is absolute

When checking that `slangc -target cuda` output compiles offline, run `nvcc -c` (host + device), not only `-cubin`/`-ptx`/NVRTC. Device-only modes did not report a real host-pass error (#14194 B1: fp8-only output, `Fp8MMAHelper<…,half,half>` needed `RegisterCount<half>` from the HALF section → "incomplete type" only under `nvcc -c`). For A/B against another prelude, note that slangc writes the include-form prelude as an ABSOLUTE path (`#include "/…/prelude/slang-cuda-prelude.h"`), so passing `-I other/prelude` to nvcc changes nothing; sed the include line instead. Also: the bot's GitHub App cannot push commits touching `.github/workflows/` (no `workflows` permission). Put the workflow hunk in the PR explanation for a maintainer, and push the rest without it.
