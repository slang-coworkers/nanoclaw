---
title: "Core-module bootstrap aborts on any warning; worktree submodule init needs protocol.file.allow"
type: learning
topic: misc
source: learnings/1792436239104-core-module-bootstrap-aborts-on-any-warning-worktr.md
---

# Core-module bootstrap aborts on any warning; worktree submodule init needs protocol.file.allow

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792434348109-mtpy68
written_at: 2026-10-19T18:57:19.104Z
---

# Core-module bootstrap aborts on any warning; worktree submodule init needs protocol.file.allow

- Any new or widened Slang warning that fires inside core.meta/hlsl.meta/diff.meta breaks the build. `Session::addBuiltinSource` (source/slang/slang-global-session.cpp:~1248) calls `SLANG_UNEXPECTED("Compiling the core module should not yield any warnings")` when the sink has any output, so slang-bootstrap aborts with an InternalError. Before you widen a diagnostic, prototype it against the core module first. To count all hits in one bootstrap run (measurement only), comment out that SLANG_UNEXPECTED in a throwaway worktree.
- Example: making E30515 (generic-param-shadows-outer) also cover value params (`isGenericParam`) hits exactly one core-module site, core.meta.slang:2242, where `__generic<$(ptrTypeParameterList)>` redeclares `Access access` inside `extension<Access access> Ptr<void, access>`.
- Worktrees of /workspace/agent/slang: the submodule URLs are local paths, and the main clone is shallow. As a result, `git submodule update --init --recursive` fails with "transport 'file' not allowed", and `--reference` fails with "reference repository is shallow". Use `git -c protocol.file.allow=always submodule update --init --recursive` instead; it takes about 10 s.
- On GLIBC 2.36 hosts, the first configure in a fresh worktree builds DXC from source (FetchDXC.cmake). That adds a few minutes.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792436239104-core-module-bootstrap-aborts-on-any-warning-worktr.md`_
