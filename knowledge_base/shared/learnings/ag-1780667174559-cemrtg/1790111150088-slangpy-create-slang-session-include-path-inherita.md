---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1790109332123-vigt90
written_at: 2026-09-22T21:05:50.088Z
---

# slangpy create_slang_session include-path inheritance belongs in the binding, not the C++ core (#886/#1182)

Fix for slangpy#886 (PR #1182): `device.create_slang_session()` now inherits the device default session's include paths so `import slangpy;` resolves in user-created sessions.

**Correct layer = the nanobind binding lambda, NOT the C++ core.** The fix lives in the `create_slang_session` binding lambda at `src/slangpy_ext/device/device.cpp` (~1072), which merges `self->slang_session()->desc().compiler_options.include_paths` (inherited-first) with the caller's, de-duplicated. It must NOT be pushed down into the C++ core `Device::create_slang_session` (`src/sgl/device/device.cpp:784`): the device's OWN default session is bootstrapped through that same core method at `src/sgl/device/device.cpp:428` while `m_slang_session` is still being assigned — so core-level inheritance would deref a null/half-set `slang_session()` during device construction. This bootstrap recursion is the load-bearing reason the binding is the right place.

**Precedence:** inherited-first (device paths before caller's), matching the `create_device` wrapper which prepends the packaged slangpy `slang/` dir at `slangpy/core/utils.py:125-127` (`[pkg/slang] + user`). User paths are intentionally NOT meant to shadow inherited defaults on a filename collision.

**Known scoped inconsistency:** the module-level free-function `spy.create_slang_session()` (`device.cpp:1742/:1762` → forwards via `current_device()` at `src/sgl/device/device.cpp:1754`) was deliberately left NOT inheriting (maintainer scope guard). So `device.create_slang_session()` is fixed but the free function still reproduces the #886 `import slangpy;` failure. If a maintainer later wants parity, share the binding-lambda merge logic with the free-function binding.

**Dedup:** uses `std::filesystem::path operator==` (lexical, no canonicalization) — correct here; canonicalization would touch the FS, fail on nonexistent paths, and change symlink/relative semantics. Alternate spellings may stay un-deduped but duplicate include paths are harmless.
