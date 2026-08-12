# Slang already has a `slang` dispatcher that routes unknown subcommands to sibling `slang-<name>` binaries — sibling-dir ONLY, no PATH

Measured 2026-08-06 @ master `d7d59f374` while triaging shader-slang/slang#12404.

## The fact
`source/slang-dispatcher/` builds an EXECUTABLE with `OUTPUT_NAME slang` and `INSTALL`. It has a builtin subcommand table (`main.cpp:66-77`: compile→slangc, interpret→slangi, help, version), and **any unknown subcommand falls through to a sibling binary named `slang-<subcommand>`** (`main.cpp:484` → `delegateToExecutable(..., nullptr)` → `:325`).

Landed in PR #10621 ("Introduce a `slang` dispatcher tool", tangent-vector, merged 2026-03-24). First release **v2026.5.1**.

⇒ A new user-facing tool named `slang-foo` becomes `slang foo` with **zero dispatcher changes**. PR #10621's body even names `slang-format` and `slang-package` as anticipated examples.

## Three gotchas, all MEASURED by execution (stub `slang-package`, positive controls)
1. **`PATH` is NOT searched.** `launchTool` checks only the directory of the running `slang` executable (`main.cpp:298`). A `slang-package` reachable only via `PATH` prints `slang: unknown command 'package'`; the *same binary* placed beside `slang` runs fine with an identical `PATH`. **This contradicts PR #10621's own prose** ("or on the system path") — so the description and the implementation disagree.
2. **No abbreviation aliasing.** `slang pkg` looks for `slang-pkg`, NOT `slang-package`. Aliases need a builtin table entry or a second installed executable/symlink.
3. **`looksLikeFilePath()` is just "contains a dot"** (`main.cpp:94`). So a subcommand containing a `.` is treated as a FILE and routed to interpreter mode instead. Name subcommands without dots.

## Where to find a `slang` binary to test with
It is NOT in `build/Debug/bin` or `build/Release/bin` (which have slangc/slangi/slangd/slang-test). It IS in the packaged tree: `build/slang-<ver>-linux-x86_64/bin/slang`. I initially reported "no dispatcher binary in this build" — a **false capability negative** that made me infer the fall-through from source when I could have executed it. Look in the packaged tree before concluding a tool isn't built.

## Test coverage
`//TEST:DISPATCHER` exists as a slang-test category (`tools/slang-test/slang-test-main.cpp:4597`) but has exactly **one** case tree-wide (`tests/dispatcher/smoke.slang`, `slang version`). The delegation path is untested.
