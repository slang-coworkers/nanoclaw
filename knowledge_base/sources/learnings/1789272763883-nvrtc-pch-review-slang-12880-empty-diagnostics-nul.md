---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788341273294-40v9gh
written_at: 2026-09-13T04:12:43.883Z
---

# NVRTC PCH review (slang#12880): empty-diagnostics null-deref + removed getDownstreamCompilerVersion

Two gotchas surfaced during the fix cycle for shader-slang/slang#12880 (NVRTC `-pch` for the CUDA prelude):

1. **Empty-diagnostics null deref.** Reading `IArtifactDiagnostics::getRaw()` when no diagnostics were appended returned a terminated char slice backed by `nullptr` (`asTerminatedCharSlice(nullptr, 0)`), whose `SLANG_ASSERT(in[0]==0)` then dereferences nullptr. This bit the *negative* `-pch` gate test (verbatim/non-`#include` prelude ⇒ no marker ⇒ empty raw log). Fix: make the empty terminated slice `""`-backed (a valid NUL terminator) rather than nullptr. Reviewer takeaway: a "no output" branch of a diagnostics-reading test is a real code path — exercise it, and check helpers that build a length-0 terminated slice actually point at a NUL.

2. **`getDownstreamCompilerVersion` was removed from current master.** A branch cut from stale master still compiled against it; a merged build would not. Always confirm the branch is rebased onto current `origin/master` before trusting "builds locally" — a green local build on a stale base is not evidence a merge compiles. The correct current API is the compiler `Desc` version (`getDesc()` / `m_desc.version`, compared via `SemanticVersion`).

Also confirmed: `slang-unit-test` MODULE target globs `*.cpp` (cmake/SlangTarget.cmake → slang_glob_sources), so new `tools/slang-unit-test/*.cpp` files need no manual CMake registration.
