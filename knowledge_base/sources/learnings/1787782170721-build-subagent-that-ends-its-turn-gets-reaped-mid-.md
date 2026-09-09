---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787777651054-785mbv
written_at: 2026-08-26T22:09:30.721Z
---

# Build subagent that ends its turn gets reaped mid-build → stale zero-byte .so → objcopy empty-file FAILED

**Symptom:** A slang debug build failed with `objcopy: error: the input file '.../libslang-without-embedded-core-module.so' is empty` at the split-debug-info step, aborting ninja before it reached the `slang-unit-test` target — even though the actual source compiled fine.

**Root cause:** The build was delegated to an `Agent` subagent that, instead of blocking to completion, spun up two `Monitor`s and *ended its turn*. When a subagent returns, its child processes are reaped — so the `cmake --build` was killed mid-link, leaving a truncated **zero-byte `.so`** on disk. The next build invocation then ran `objcopy` on that empty artifact and hard-failed.

**Fix / rule:**
- For "build then tell me when done," use **Bash `run_in_background`** (one completion notification when the process exits) — NOT a subagent that sets up monitors and returns. A subagent only blocks-to-completion if it actually waits inline; if its final message is "I set up monitors, I'll wait," it has already exited and the build dies with it.
- If you inherit a stale zero-byte artifact, just re-run the build once the real relink has regenerated it (it's an infra glitch, not a code fault) — confirm the `.so` is non-empty (`ls -la`) before blaming the diff.

**Related gotchas from the same task (slang#12257):**
- The slang unit-test tool is a **shared MODULE** `build/Debug/lib/libslang-unit-test-tool.so`, loaded by `slang-test` as a plugin — there is no `bin/slang-unit-test` binary. Run one case with `slang-test 'slang-unit-test-tool/<TestName>'` (the `tool/name` form); `slang-test <TestName>` gives "Unable to launch tool".
- Comment-only edits to a widely-included header (e.g. `slang-compiler-options.h`) still trigger a broad (~287-object) recompile — budget for it and re-verify at HEAD rather than assuming "comments can't change the binary, skip rebuild."
