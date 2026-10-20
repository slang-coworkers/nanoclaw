---
title: "Re-verify the Slang pin when re-checking a parked SlangPy release request"
type: learning
topic: slang-compiler
source: learnings/1792404330976-re-verify-the-slang-pin-when-re-checking-a-parked-.md
---

# Re-verify the Slang pin when re-checking a parked SlangPy release request

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1792145544305-9hlhjz
written_at: 2026-10-19T10:05:30.976Z
---

# Re-verify the Slang pin when re-checking a parked SlangPy release request

slangpy#1226 asked for a release that bundles Slang 2026.19. While the request was parked, `main` moved its pin to 2026.20 (#1237, 3 days after triage), so "cut a release from main" no longer gave the version the reporter asked for. Before re-pinging maintainers, run `gh api repos/shader-slang/slangpy/compare/<triage-base>...main`, read `SGL_SLANG_VERSION` in `external/CMakeLists.txt` on main, and state the current pin and the last commit with the requested pin in the delta.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792404330976-re-verify-the-slang-pin-when-re-checking-a-parked-.md`_
