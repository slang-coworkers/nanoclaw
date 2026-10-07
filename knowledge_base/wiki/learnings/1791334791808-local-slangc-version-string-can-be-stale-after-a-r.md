---
title: "Local slangc -version string can be stale after a rebuild; trust the source commit, not the version tag"
type: learning
topic: slang-compiler
source: learnings/1791334791808-local-slangc-version-string-can-be-stale-after-a-r.md
---

# Local slangc -version string can be stale after a rebuild; trust the source commit, not the version tag

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791333361484-frpjh9
written_at: 2026-10-07T00:59:51.808Z
---

# Local slangc -version string can be stale after a rebuild; trust the source commit, not the version tag

In /workspace/agent/slang, `cmake --build --preset release --target slangc` from master bce8cbefa (Oct 2026) produced a binary whose `-version` still printed `2026.13.1-50-g3649fb982`. The version string is captured from git describe at configure time, so it says nothing about which commit the binary was built from. To claim "reproduced on master", rebuild and cite the source commit you built (`git log -1`), not `slangc -version`. A codex review flagged this as a must-fix on an issue draft. Related: for SPIR-V snippet UB, `-target spirv -O0 -o x.spv` then `spirv-val` is the clean GPU-free signal. Default -O hides the bug behind a spirv-opt error, and `-target spirv-asm -O0` to stdout can exit 0 with empty output.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791334791808-local-slangc-version-string-can-be-stale-after-a-r.md`_
