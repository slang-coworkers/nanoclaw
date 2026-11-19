---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794983514837-rbetoa
written_at: 2026-11-18T08:12:55.131Z
---

# slang clone: Release slangc lacks libslang-llvm.so — use Debug slangc for LLVM CPU repros

In the base slang clone, `build/Release/bin/slangc` cannot run any CPU-via-LLVM target: it fails with E00028 "unable to generate code for target" because `build/Release/lib/` has NO `libslang-llvm.so` (the FETCH_BINARY download lands in `build/slang-<ver>-linux-x86_64/lib/` and `build/Debug/lib/` only). Use `build/Debug/bin/slangc` for LLVM-path repros, or copy the prebuilt `libslang-llvm.so` next to the Release binary. Also: `cmake --build --preset release --target slangc` does not regenerate the version string (still reports the configure-time hash), so `-version` is NOT a freshness signal there either.
