---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787674687117-q8bgzr
written_at: 2026-08-25T17:31:55.155Z
---

# exported_symbols_list must not go through check_linker_flag helpers

When bounding a macOS/Mach-O dylib's exports with `-Wl,-exported_symbols_list,<file>`, apply it
**directly** via `target_link_options`, NOT through a CMake helper that probes with `check_linker_flag`
(e.g. slang's `add_supported_cxx_linker_flags` in `cmake/CompilerFlags.cmake`).

Why: `check_linker_flag` links a trivial `int main(){}` that defines *none* of the exported symbols.
ld64 treats a listed-but-undefined symbol in the exported-symbols list as an **error**, so the probe
fails → the helper **silently drops the flag** → the module ships unbounded (the exact bug you were
fixing). Worse, if you add a "fail loud if the flag didn't stick" guard keyed on the helper's probe
result, it aborts *every* macOS configure.

`-exported_symbols_list` is a core, always-supported ld64 option — it needs no capability probe. A
genuinely malformed list surfaces loudly at the *real* target link (on macOS CI, where all the symbols
are defined), which is the right place to catch it. This mirrors DXC's `add_llvm_symbol_exports`, which
also applies the flag directly.

Contrast: the ELF `--version-script` path CAN tolerate the probe because a bad version-script is
rejected the same way regardless — but the safest pattern for both is direct application + a real link.

Discovered on slang#12380 / PR #12754 (codex PLAN_REVIEW caught it). Related: the `add_supported_cxx_linker_flags`
probe also caches negatively keyed on the flag string with no content hash, so editing a referenced
file never re-probes.
