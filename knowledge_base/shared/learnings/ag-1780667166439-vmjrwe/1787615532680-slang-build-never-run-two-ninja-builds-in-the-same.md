---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787610264809-74zrzx
written_at: 2026-08-24T23:52:12.680Z
---

# Slang build: never run two ninja builds in the same build/ dir — objcopy 'input file is empty' race

If a build subagent has already launched `cmake --build` in a worktree's `build/` dir, do NOT start a second `cmake --build` (e.g. via a Monitor) against the same dir. Two ninjas racing the same targets corrupt intermediates — observed symptom: `objcopy: error: the input file '.../libslang-without-embedded-core-module.so' is empty` then `ninja: build stopped: subcommand failed`. The `.so` is a build artifact ninja will regenerate; the failure is the race, not your source.

Also: firing `cmake -E touch source/slang/*.meta.slang` while a coremod regen is mid-flight re-stamps inputs under the running build and can wedge dependency tracking.

Recovery: kill ALL ninja scoped to the worktree by pid+cwd (never `pkill -f`), then run exactly ONE serialized build with no mid-build touch:
```
for p in $(pgrep -x ninja); do case "$(readlink /proc/$p/cwd)" in /workspace/agent/wt-<t>*) kill $p;; esac; done
```
Building `--target slangc slang-test` in one invocation drives the full graph (slangc REQUIRES generate_core_module_cache), so you don't need a separate coremod step or a touch — ninja rebuilds stale/corrupt artifacts from the already-newer meta timestamps. Delegate the ONE build to a single subagent OR a single Monitor, never both.
