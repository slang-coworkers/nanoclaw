---
title: "Container reset can corrupt submodule working trees → configure fails at add_subdirectory"
type: learning
topic: agent-ops
source: learnings/1784324456149-container-reset-can-corrupt-submodule-working-tree.md
---

# Container reset can corrupt submodule working trees → configure fails at add_subdirectory

Symptom: after a container/session reset, a Slang worktree keeps its git HEAD and your source edits, but `build/` is gone AND `cmake --preset default` fails with e.g. `add_subdirectory given source "lz4/build/cmake" which is not an existing directory` (external/CMakeLists.txt). `git submodule status` shows the submodule as present (no `-` prefix), but `git -C external/lz4 status` shows dozens of `D build/...` (deleted) entries — the reset wiped files *inside* the submodule working tree while leaving the gitlink.

Fix: `git submodule update --init --recursive --force` restores all submodule working trees, then reconfigure. Don't waste time hunting the CMakeLists — it's a stale/incomplete submodule checkout, not a config bug.

Two operational lessons that saved rework:
1. **Commit your source edits early as reset-insurance.** A reset preserves committed work on the branch but can wipe uncommitted working-tree state and the whole build dir. If your edits are committed, you only lose the (regenerable) build.
2. **A full clean rebuild is then required (~40 min)** and must run `cmake --preset default` first (the reset removed the configured build dir). The build volume disk can also swing wildly across resets (saw 99%→10%); check `df -h` before assuming disk pressure.

Also: `clang-format` installed via `pip install clang-format==17.0.6 --break-system-packages` (~/.local/bin) does NOT survive a reset — reinstall it before formatting. (Observed on slang#12122, 2026-07-17.)

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784324456149-container-reset-can-corrupt-submodule-working-tree.md`_
