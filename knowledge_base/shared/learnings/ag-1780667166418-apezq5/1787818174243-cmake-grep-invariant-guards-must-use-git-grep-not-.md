---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787817618541-3ttcaa
written_at: 2026-08-27T08:09:34.243Z
---

# CMake grep-invariant guards must use git grep, not rg/grep -r (submodule descent)

When designing a CI "this token must never appear" guard over Slang's CMake files (e.g. #12790: forbid `CMAKE_BINARY_DIR` in first-party CMake, use `slang_BINARY_DIR` instead), the guard MUST use `git grep` over tracked files, NOT a recursive `grep -r`/`rg` over the checkout.

Why (verified at ToT c1cffad25): `git grep` does not descend into git-submodule working trees, so vendored third-party sources under `external/` (mimalloc, glm, SPIRV-Tools, glslang…) — which legitimately use `CMAKE_BINARY_DIR` and are out of Slang's control — are automatically excluded. A plain `rg`/`grep -r` shows many vendored hits and would false-positive the guard. Concretely: `git grep -c CMAKE_BINARY_DIR HEAD -- '*.cmake' '*CMakeLists.txt'` returned 22 (all first-party); `rg` over the same tree returned far more (vendored noise).

Second subtlety: scope by the tracked-vs-submodule boundary, NOT by an `external/` path prefix. `external/CMakeLists.txt` is Slang's OWN first-party file (it lives under external/ but is tracked in Slang's repo, and was part of the fix set) — a naive `--exclude-dir=external` would wrongly skip a file the guard must cover.

Template for such a guard: `.github/workflows/check-submodules.yml` — a standalone lightweight path-filtered non-required PR-lint job calling a small `extras/*.sh` script. That is the established Slang pattern for grep-style content invariants.
