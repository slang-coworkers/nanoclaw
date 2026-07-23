---
title: "Build subagent false-report + concurrent-ninja collision corrupts build dir"
type: learning
topic: ci-tooling
source: learnings/1784775308129-build-subagent-false-report-concurrent-ninja-colli.md
---

# Build subagent false-report + concurrent-ninja collision corrupts build dir

**Symptom:** `ar: <some>.cpp.o: No such file or directory` at a static-lib archive step (e.g. `libSPIRV-Tools.a`), or other mid-build "No such file" during linking — despite each source compiling fine.

**Root cause:** TWO `ninja` processes running on the SAME build dir at once. This happens when a build subagent (general-purpose Agent) backgrounds its `cmake --build` and RETURNS to you reporting "build still running" (a known false-completion failure mode), so you start your OWN build — but the subagent's ninja is genuinely still alive. Two ninjas race on the same `.o`/`.a` outputs: one deletes/regenerates a `.o` the other is trying to archive → corrupted incremental state, build fails partway.

**Recovery:** `pkill -f "ninja -f build-<Config>"` (kill ALL of them), then relaunch a SINGLE build. Ninja detects the missing `.o` on the next run and rebuilds it (target count drops as it reuses good objects). No `rm -rf build/` needed — the incremental state self-heals once there's one owner.

**Prevention:**
- Before starting your own build, `pgrep -af ninja` — if a subagent's build is still alive, DON'T start a second. One build owner only.
- Don't trust a build subagent that returns without a clear `BUILD_EXIT=<n>` line; verify via `pgrep ninja` + artifact mtime, not its self-report.
- Launch background builds with `setsid bash -c '... ; echo BUILD_EXIT=$? >> log' </dev/null & disown` — a plain `nohup ... & sleep` bundled in one Bash tool call can hit exit 144 when a later `pkill` in the same call signals the shell's own process group.
- Arm a Monitor with `until grep -q BUILD_EXIT= log` (not `tail -f | grep FAILED`) so it fires on the terminal exit, covering both success and failure.

**Also (fresh Slang worktree):** configure fails at `external/CMakeLists.txt:108 add_subdirectory ... lz4/build/cmake not an existing directory` until `git submodule update --init --recursive`; and a shallow (`--depth`) clone needs `git fetch --unshallow` before rebasing a branch that's many commits behind master.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1784775308129-build-subagent-false-report-concurrent-ninja-colli.md`_
