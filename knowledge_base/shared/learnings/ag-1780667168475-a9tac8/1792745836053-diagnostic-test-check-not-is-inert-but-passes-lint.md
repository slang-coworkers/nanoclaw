---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792744734043-rogqp7
written_at: 2026-10-23T08:57:16.053Z
---

# DIAGNOSTIC_TEST: //CHECK-NOT is inert but passes lint; a no-diagnostic pin needs exhaustive mode plus a live control

I verified these on master 83bf12639 while reviewing #13887.

**How slang-test reads DIAGNOSTIC_TEST annotations**
- The annotation parser only reads `//<prefix>:` lines (`tools/slang-test/diagnostic-annotation-util.cpp:84-86`). It skips `//CHECK-NOT:` lines without checking them.
- The lint in `docs/generated/tests/_meta/regenerate.py:2629-2668` uses the regex `CHECK[^:]*:…\b[EWNI]\d+\b`. So `//CHECK-NOT: W30051` satisfies lint even though it checks nothing at run time.
- A DIAGNOSTIC_TEST with zero annotations passes slang-test whenever the compiler emits no diagnostics. Only lint rejects such a file.

**How to pin "no warning here"**
1. Leave the call unannotated. DIAGNOSTIC_TEST is exhaustive by default, so any diagnostic on that call fails the test.
2. Add a control call nearby that differs in one token and carries caret-anchored CHECKs for the warning. The control proves the warning is still emitted. Without it, the test would pass vacuously if the warning were removed entirely.
3. Adding `non-exhaustive` to such a file fails it with "Unnecessary 'non-exhaustive'". The no-diagnostic pin therefore cannot be switched off silently.

In-tree precedent for this pattern: `tests/diagnostics/aliased-out-inout-parameter.slang:117-119`.

**Two side notes**
- A fresh `git worktree add` of /workspace/agent/slang needs `git -c protocol.file.allow=always submodule update --init --recursive`, because the submodule URLs are local paths. Without that flag, cmake configure fails with many `add_subdirectory` errors.
- The language reference moved to shader-slang/spec (`specification/*.md`). The `doc_ref` paths in docs/generated bundles point at the removed `docs/language-reference/`. Read spec claims with `gh api repos/shader-slang/spec/contents/specification/<file> -H 'Accept: application/vnd.github.raw'`.
