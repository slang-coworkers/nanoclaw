---
title: "sgl_tests exit-code flake (#1062): no minidump exists, fault is post-main teardown, fix with std::_Exit"
type: learning
topic: ci-tooling
source: learnings/1783932346816-sgl-tests-exit-code-flake-1062-no-minidump-exists-.md
---

# sgl_tests exit-code flake (#1062): no minidump exists, fault is post-main teardown, fix with std::_Exit

**Context:** slangpy#1062 — `sgl_tests` (doctest via `tools/ci.py unit-test-cpp`) prints a green `[doctest] Status: SUCCESS!` then the *process* exits nonzero during teardown → ci.py `run_command` raises `RuntimeError` → reds the cross-repo "SlangPy Tests" check on unrelated slang PRs (runs via repository_dispatch; bot can't rerun — cross-repo admin boundary).

**Three non-obvious findings that corrected the triage memo:**

1. **The crashpad minidump does NOT exist and is NOT recoverable.** Both CI runs (27965567210 passing, 29232873855 failing) logged `No files were found with the provided path: .crashpad/reports/. No artifacts will be uploaded.` — `total_count: 0`, never created (not expired). Crucially the *passing* run's crashpad dir is ALSO empty → empty is the steady state. Any triage step that says "stackwalk the minidump first" is void here — verify the artifact actually exists (`gh api repos/OWNER/REPO/actions/runs/<id>/artifacts`) before planning around it.

2. **Exit-code + log signature pins the fault to POST-main, without a dump.** Exit code was exactly `1` — NOT `0xC0000005`/`3221225477` (Windows access violation) and NOT `3` (MSVC abort). The child printed NOTHING between the green summary and ci.py's RuntimeError (no "terminate called", no live-objects report). By elimination: an AV in main()'s explicit teardown → crashpad dump (none); an uncaught C++ exception → "terminate called" + exit 3 (neither). ⇒ main() returns 0 and the nonzero exit is in the C-runtime post-main phase (global/static dtors + GPU-driver/Vulkan-loader/slang-rhi DLL unload at process detach), outside crashpad's captured window. This makes a try/catch-in-main fix (triage's variant "a") a likely NO-OP — the fault isn't in main's scope at all.

3. **Fix = `std::_Exit(result)` NOT `std::quick_exit`.** Replace the final `return result;` in `tests/sgl/sgl_tests.cpp` main() with `std::fflush(nullptr); std::_Exit(result);` (add `<cstdio>`+`<cstdlib>`). Exit code == doctest status; the flaky post-main phase is skipped; all earlier signals preserved (mid-test crash dies in context.run() before _Exit → crashpad reds; explicit-teardown crash dies before _Exit → reds; real failure keeps result!=0). **Use `_Exit`, not `quick_exit`** — Apple's libc historically omits `quick_exit`/`at_quick_exit`, so quick_exit risks a macOS build break; `_Exit` has identical effect and is universal. (Precedent: slangpy already uses os._exit in SIGSEGV regression tests to stop teardown perturbing exit code.)

**Disk-cheap verification when a full build won't fit:** `g++ -fsyntax-only` on the edited TU using the exact flags from `build/<preset>/compile_commands.json` (strip `-c` and `-o <file>`, swap in the edited source path, append `-fsyntax-only`) — type-checks against real headers with ~zero disk. Not a substitute for build/link, but catches include/namespace errors. This flake only truly validates via CI soak (~20d between occurrences) on the nvrgfx-Windows GPU runner.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783932346816-sgl-tests-exit-code-flake-1062-no-minidump-exists-.md`_
