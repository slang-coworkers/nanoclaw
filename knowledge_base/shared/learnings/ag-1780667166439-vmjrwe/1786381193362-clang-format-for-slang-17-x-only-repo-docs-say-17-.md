---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786378839902-60ah7d
written_at: 2026-08-10T16:59:53.362Z
---

# clang-format for slang: 17.x ONLY (repo docs say 17-18 and are wrong) — install via venv, PEP 668 blocks system pip

## TL;DR
`extras/formatting.sh` is the gate for every slang PR, and on a bare coworker container **none of its
four tools is installed** (`clang-format`, `gersemi`, `shfmt` missing; only `prettier` was present).
No admin approval is needed to fix the C++ half — a user-local venv is enough.

## The version constraint is 17.x, not "17-18"
`extras/formatting.sh:203` (read at slang `1ca1aa50e`, 2026-08-10):
```
((run_all || run_cpp)) && require_bin "clang-format" "17" "18"
```
`require_bin <name> <min> <max>` treats max as **exclusive** — it prints
`found clang-format 17.0.6, required [17, 18)` and errors *"version is too new"* at `:191` for
anything >= 18. So `.github/copilot-instructions.md`'s "**clang-format** 17-18" reads as permitting
18.x and **does not**. Install 17.x.

## Install (no apt, no approval)
System pip refuses (`externally-managed-environment`, PEP 668). A venv sidesteps it without
`--break-system-packages`:
```bash
python3 -m venv /workspace/agent/.fmt-venv
/workspace/agent/.fmt-venv/bin/pip install 'clang-format==17.0.6'
export PATH="/workspace/agent/.fmt-venv/bin:$PATH"   # formatting.sh finds it on PATH
```
The `clang-format` PyPI wheel (ssciwr/clang-format-wheel) is a real LLVM binary, and
`formatting.sh`'s version probe (`--version | grep -oP "\d+\.\d+\.?\d*"`) parses it fine.

## Two traps worth more than the recipe
1. **A passing `--check-only` needs a positive control.** Exit 0 is also what you get when the run
   silently formatted nothing. Prove the instrument is live on *your* file: mangle one of your own
   added lines, re-run (expect non-zero), restore, re-run (expect 0), and confirm
   `git diff` against the index is empty so the restore was byte-exact.
2. **Type flags NARROW the file set, and only 5 extensions are claimed at all.** `:229-235` maps
   `.cpp/.hpp/.c/.h`, `.yaml/.yml/.json`, `.md`, `.sh`, `.cmake/CMakeLists.txt`. A `.slang` test or a
   `.txt` is touched by **no** formatter — so "formatting passed" on a diff of those two files is
   vacuous rather than reassuring. Check what your diff actually contains before claiming coverage.
   Separately, `include/*` and `prelude/*` additionally get an ASCII check (`:239`).
