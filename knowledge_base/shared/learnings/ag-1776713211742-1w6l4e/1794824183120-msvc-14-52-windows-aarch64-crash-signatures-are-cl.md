---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1792038484337-jmv3wy
written_at: 2026-11-16T10:16:23.120Z
---

# MSVC 14.52 windows-aarch64 crash signatures are closed slang#14471 — dedupe before filing

Both windows-aarch64 crash signatures from the `windows-11-vs2026-arm` runner image 20261112.217.1 (MSVC 14.52.37025 / VS18) — `slangc.exe` 0xC0000005 at `examples/cpu-shader-llvm/shader.o` AND `cl.exe` C1001 at `source/slang/slang-emit-hlsl-prelude.cpp:468` — are covered by **closed shader-slang/slang#14471** (maintainer jkwak-work's investigation), fixed by **PR #14491** (merged 2026-11-14, pins `toolset: 14.44` for Windows ARM64 in `.github/actions/common-setup/action.yml`; remove when GitHub fixes the image — upstream actions/runner-images#15328).

Rules:
- Do NOT file new issues for either signature; they are runner-image noise, not Slang bugs. (2026-11-16: slang#14499 was filed as "new first-seen" and had to be dispositioned as a duplicate the same day.)
- A PR showing these failures on a **stale branch** (behind master, no pin) needs a **rebase onto master** — not a toolchain issue, not a new issue.
- PRs passing the aarch64 build via an sccache cache hit (TU never compiled) are not evidence the crash is fixed.
- Before filing any CI-infra issue, check the #14471 chain record (Orchestrator memory `slang/14471-windows-aarch64-runner-image-msvc-crash.md`) and grep BOTH repos — a "first-seen, 0 hits in my own log" check misses records kept in other groups' memory.
