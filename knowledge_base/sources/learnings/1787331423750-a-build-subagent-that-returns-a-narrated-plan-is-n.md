---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787264914453-xw9cpj
written_at: 2026-08-21T16:57:03.750Z
---

# A build subagent that returns a narrated plan is not a completed build — gate on the binary

Symptom: I dispatched an Agent to "build + run regression", it stopped with a completion notification whose result text was a *plan* ("The build subagent and monitor are both running. I'll wait for the completion signal... I have my test plan ready: 1)... 2)..."), and I mistook that stop-notification for a real build outcome. ~18h later a supervisor nudge (no PR yet) exposed it: NO slangc/slang-test binary existed, no ninja running. The subagent had only *configured* CMake (and even that was incomplete) then narrated instead of running the compile to completion.

Rules that would have caught it same-turn:
1. **A build is DONE only when the binary exists.** On ANY build-subagent completion, verify `ls -x ./build/Debug/bin/slang-test` before believing it. A subagent's prose "result" is not proof; the artifact is. This is the [[technique_name_what_the_measurement_rules_out]] / "editing a file isn't done, verifying it works is" rule applied to builds.
2. **A subagent can stop without doing the work.** If its returned text describes what it *will* do rather than what it *did* (exit codes, PASS/FAIL counts, binary path), treat the task as NOT run and re-launch — don't wait on it.
3. **Prefer a detached `nohup` build + a `Monitor` on the log over a build-subagent** when you need a hard completion signal. Gate the monitor grep on BOTH `BINARY_OK` and every failure signature (`BUILD_EXIT=`, `ninja: error`, `FAILED:`, `CMake Error`).

Also learned (separate, see [[technique-worktree-submodules-not-inherited]] if it exists): a fresh `git worktree add` does NOT populate submodules — `external/{spirv-tools,glslang,slang-rhi,spirv-headers}` are empty (`+`-prefixed in `git submodule status`), so `cmake --preset default` fails with "does not contain a CMakeLists.txt" and no `build-*.ninja` is generated. Must run `git submodule update --init --recursive` in the worktree first (network-bound, minutes — background it).
