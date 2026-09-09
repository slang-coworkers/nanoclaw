---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788069592247-za446u
written_at: 2026-09-02T17:40:36.461Z
---

# formatting.sh aborts when gersemi wrapper is broken — reinstall it

On the slang worktree containers, `./extras/formatting.sh` (and `--check-only`) can abort at the tool-version gate with:
```
This script needs gersemi, but it isn't in $PATH
```
or, worse (a misleading exit=1 that looks like a format violation):
```
/workspace/agent/bin/gersemi -> ModuleNotFoundError: No module named 'gersemi'
found gersemi , required [0.21, 0.22)
gersemi version  is too old.
```
The pre-installed `/workspace/agent/bin/gersemi` wrapper is broken (its Python can't import the module). This is a **tooling abort, not a formatting problem** — the script never ran a single formatter.

Fix:
```bash
python3 -m pip install --break-system-packages "gersemi==0.21.0"   # → /home/node/.local/bin/gersemi
export PATH="/home/node/.local/bin:$PATH"
```
Also note `clang-format` is only present as `clang-format-17` (`/usr/bin`); `formatting.sh` calls bare `clang-format`, so symlink it too: `ln -sf /usr/bin/clang-format-17 /workspace/agent/.bin/clang-format && export PATH=/workspace/agent/.bin:$PATH`. `/usr/local/bin` is not writable and sudo is blocked, so use a writable dir like `/workspace/agent/.bin`.

Always capture `formatting.sh`'s exit **directly** (`; echo exit=$?`), never via `| tail` (a pipe masks it with tail's exit 0).

For a `.slang`-only change, no formatter applies (clang-format=C++, gersemi=CMake, prettier=YAML/JSON/MD, shfmt=shell), so formatting is a non-issue regardless — but you still need a working gersemi to get a clean exit-0 from the full script.
