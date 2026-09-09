---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1788164848055-fa518m
written_at: 2026-08-31T08:38:33.318Z
---

# slangpy sanitizers.yml LSan leak has no suppression path; the cycle is in the Python cache layer, not the C++ m_args graph

Triaging slangpy#1130 (nightly `sanitizers.yml` LSan leak, `NativeBoundCallRuntime::m_args`) surfaced three non-obvious facts worth reusing:

1. **There is NO LSan suppression mechanism in slangpy.** The issue (and the obvious instinct) suggests "suppress in `tools/asan-suppressions.txt`" — but that file holds only ASan `interceptor_via_lib:` entries for GPU driver libs, and `tools/filter-lsan-reports.py` reads NO suppressions file. It attributes a leak root to the project purely by matching the first non-allocator frame against paths (`src/sgl|src/slangpy_ext|src/slangpy_torch|tests|external/slang-rhi`), binary markers, or the symbol regex `\b(?:sgl|rhi|slangpy)::|\bslangpy_ext\b`, and exits 1 on any project-attributed direct root. So "suppress the leak" is NOT a config edit — it would require building a new LSAN_OPTIONS suppressions path or editing the filter's attribution. Combined with the maintainer's demonstrated fix-first stance (#1108 fixed sanitizer leaks rather than suppressing), suppression is the disfavored path.

2. **A C++-only ownership trace can wrongly conclude "no cycle / benign retention."** A subagent (and DeepWiki) tracing only the immediate C++ members concluded `NativeBoundCallRuntime → m_args → NativeBoundVariableRuntime` is a pure downward DAG with no back-pointer → "suppressible." That misses the real cycle: `NativeBoundVariableRuntime::m_vector_type : ref<refl::Type>` (`slangpy.h:495`) is an edge INTO the reflection/Layout graph, and the retaining cycle lives in the Python **module-attribute / instance-method / reflection caches** (the merged #1113 `Layout⇄Type/Function` territory). The tell that it's a real cycle, not retention: the maintainer's fix uses **weak references** and names its tests `..._does_not_create_ownership_cycle`. Lesson: when analyzing intrusive-refcount (`sgl::ref`) leaks, follow `ref<refl::Type>`/marshall edges up into the reflection + Python cache layers; don't stop at the C++ struct members.

3. **The gate only runs on Linux.** `sanitizers.yml`'s "Check LeakSanitizer Reports" step is gated `matrix.os == 'linux'`, and triggers are `schedule + workflow_dispatch` only (no `pull_request`) — so Windows/macOS "passing" is partly because they never run the gate, and the leak-gate never runs on PRs.

Also: an existing fix branch may exist off-PR. For #1130 the two green `workflow_dispatch` SHAs traced to `dev/skallweit/weak-ref` (no PR, stale) — always check `git branch --contains`/compare a passing SHA before assuming net-new work is needed.
