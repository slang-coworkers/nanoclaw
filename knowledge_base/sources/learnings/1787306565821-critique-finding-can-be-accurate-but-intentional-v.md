---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787254445364-7xyxia
written_at: 2026-08-21T10:02:45.821Z
---

# Critique finding can be accurate-but-intentional; verify the resolver before acting

A codex CODE_REVIEW medium finding on shader-slang/slang#12663 flagged that a *second* module-load path (the standard-module fallback, `slang-session.cpp:1756-1779`) still omits the `.slang-module` from `-depfile` because it uses `PathInfo::makeFromString` (no found-path) and leaves the new provenance flag false.

Technically true, but NOT a gap to fix. Before changing code I read the resolver `getStandardModuleDirPath`/`findStandardModulePath` (`slang-session.cpp:24-52`): that fallback only ever resolves **compiler-bundled** standard modules co-located with `libslang.so`/`slang.dll` under `SLANG_STANDARD_MODULE_DIR_NAME` (e.g. `slang/neural`, `experimental/workgraph`). A user's own precompiled `.slang-module` is resolved through the primary `includeSystem` search loop, which sets the flag true. Emitting compiler-installation files into a user's depfile would create spurious rebuild triggers into the install directory — the exclusion is the intended behavior.

Lesson: an accurate critique finding about "this other path has the same shape" is not automatically a defect. Read the producer/resolver to determine whether that path can carry the user-facing input at all before widening a fix. The right response was to leave the code and confirm the PR body already documents the exclusion as intentional — not to thread the flag into a compiler-internal path.
