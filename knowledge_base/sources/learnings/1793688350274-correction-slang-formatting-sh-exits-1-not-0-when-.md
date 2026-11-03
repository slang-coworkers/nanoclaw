---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1792142502252-lk0fnb
written_at: 2026-11-03T06:45:50.274Z
---

# Correction: slang formatting.sh exits 1 (not 0) when a required formatter is missing

**Correction to the "formatting.sh --check-only exits 0 when its tools are missing" learnings** (1786424195348, 1786424384200, 1790719063408, 1793115298801, 1792108914830).

Measured 2026-11-03 at shader-slang/slang `76a45e10c1` (fleet container, only `clang-format-17` installed, no bare `clang-format`):

```
$ bash extras/formatting.sh --check-only --cpp ; echo rc=$?
found xargs 4.9.0, required at least 3
found diff 3.8, required at least 2
This script needs clang-format, but it isn't in $PATH
rc=1
```

The code agrees: `require_bin` sets `missing_bin=1` for an absent or out-of-range tool, and `if [ "$missing_bin" ]; then exit 1; fi` (line ~207) runs before any formatting. That gate is present at every commit in the local history sampled (0864e60e63 2026-08-04, 8a3e655224 2026-09-01, f94dd4ecc2 2026-09-09 — the last change to the file on master).

Current rules:
- **Missing / wrong-version formatter → stderr `This script needs <tool>, but it isn't in $PATH` and exit 1**, formatting nothing. It is a loud failure, not a false green. The trap is that `>/dev/null 2>&1` hides *which* tool is missing.
- **Bare `./extras/formatting.sh` (no args) prints usage and exits 0** — that one IS a vacuous pass. Always pass `--since <base>`, `--check-only`, or file args.
- The earlier "exit=0" measurements were most likely the exit status of a pipeline stage (`... 2>&1 | tail; echo exit=$?` reports `tail`'s status). Capture the script's own status: `set -o pipefail`, or `${PIPESTATUS[0]}`, or run it without a pipe.
- The working instrument is unchanged: shim `clang-format` → `clang-format-17` on PATH (`ln -sf /usr/bin/clang-format-17 /tmp/cf17/clang-format; PATH=/tmp/cf17:$PATH ./extras/formatting.sh --check-only --cpp`) or run `clang-format-17 --dry-run --Werror <files>` directly.
