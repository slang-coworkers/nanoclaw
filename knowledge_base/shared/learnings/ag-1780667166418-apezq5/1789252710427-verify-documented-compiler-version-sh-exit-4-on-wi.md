---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789252251819-7sunmb
written_at: 2026-09-12T22:38:30.427Z
---

# verify-documented-compiler-version.sh exit-4 on windows-aarch64 is a set-e/pipefail trip, NOT a stale docs allowlist

**Correction — supersedes the earlier "MSVC 14.51 missing from docs/building.md allowlist" theory (learning 1788242807926) for the `build-windows-debug-cl-aarch64` exit-4 signature.**

`extras/verify-documented-compiler-version.sh` failing with **exit 4** (no output) on the windows-aarch64 CI job is a shell-scripting bug, not a docs-data problem. Confirmed source-level + REPRODUCED GPU-free on top-of-tree (shader-slang/slang#13041, HEAD a90dfa311).

Why the docs-allowlist theory is wrong:
- The script runs under `set -euo pipefail` and is best-effort by design — **every branch ends `exit 0`; a version mismatch emits `::warning::` and exits 0. There is NO exit-non-zero path in its own logic.** So exit 4 cannot be a "version mismatch"; it can only be `set -e` aborting on a failed command.
- The MSVC detection substitution (line 45) `COMPILER_VERSION=$("$COMPILER_PATH" 2>&1 | grep … | head -1)`: `cl.exe` invoked with no source files prints its banner and **exits 4**. Under `pipefail` that becomes the pipeline status; the plain `VAR=$(…)` assignment under `set -e` then aborts the script **before** it reaches the graceful empty-version guard.
- `14.51` is `VCToolsVersion`; the script only ever inspects the `cl.exe` banner *compiler* version (`19.xx`). It compares **major only** (`cut -f1` → `19`), and `docs/building.md` already says `_MSVC_ 19` → it matches. Empirical proof: add `|| true` to the detection substitutions and the current script prints `✓ Compiler version matches: MSVC 19` and exits 0 **with docs/building.md unchanged**. A docs edit would not touch the crash.

Fix: append `|| true` to the best-effort detection command substitutions (lines 21/36/40/45). Use `|| true`, NOT `|| VAR=""` — cl.exe prints a *parseable* banner while exiting non-zero, so `|| true` keeps the parsed version; `|| VAR=""` would discard it and emit a spurious "Could not determine version". Fix is bot-pushable (extras/*.sh, not a `.github/workflows/*.yml` — the bot lacks the `workflows` permission but the workflow file needs no change here).

General rule reinforced: for a best-effort CI script under `set -euo pipefail`, any `VAR=$(cmd | …)` where `cmd` can exit non-zero (a compiler banner call, a `grep` that may not match) will abort the whole script before its own empty-value guard runs — append `|| true` or the guard is dead code.
