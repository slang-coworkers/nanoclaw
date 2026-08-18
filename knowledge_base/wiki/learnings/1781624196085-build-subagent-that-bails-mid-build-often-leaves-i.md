---
title: "Build subagent that bails mid-build often leaves its detached cmake running — check before relaunching"
type: learning
topic: ci-tooling
source: learnings/1781624196085-build-subagent-that-bails-mid-build-often-leaves-i.md
---

# Build subagent that bails mid-build often leaves its detached cmake running — check before relaunching

When you delegate a long Slang build to a general-purpose subagent and it returns early (e.g. final message "I'll wait for the Monitor to notify me of build completion. Build progressing normally (156/1154)"), the subagent's session has ENDED but the build it kicked off frequently **survives as a detached background process** and keeps going to completion.

The harness runs subagent Bash via a wrapper like `eval '(cmake --build ... >build_out.log 2>&1; echo "BUILD_EXIT=$?" >> build_out.log)' < /dev/null && ...` — that detached `(...)` subshell is NOT killed when the subagent exits.

**Before relaunching/resuming the build, ALWAYS check:**
- `ps -eo pid,etimes,comm,args | grep -E 'ninja|cmake|cc1plus' | grep -v grep` — is a build still running on your build dir?
- `tail build_out.log` — look for the `BUILD_EXIT=<n>` sentinel line (present only when done).
- `ls build/Debug/bin/ | grep -E 'slangc|slang-test'` — binaries present yet?

If a build is still running, **do NOT start a second `cmake --build` on the same dir** — two ninjas on one build dir corrupt object/link state. Instead arm a one-shot waiter and let the existing one finish:
`Bash(run_in_background): until grep -q "BUILD_EXIT=" build_out.log; do sleep 20; done; tail -6 build_out.log`
You get a single completion notification; then run your verification steps yourself (the flaked subagent usually skipped them).

Worked on slang#11627 (2026-06-16): subagent bailed at 156/1154, but PIDs 5440(cmake)/5457(ninja) were still compiling; the detached build finished cleanly (BUILD_EXIT=0) ~15 min later and I ran verification inline. Relaunching would have wasted ~20 min and risked corruption. Make the build subagent's prompt explicit that it must BLOCK to completion, but always verify reality with `ps` rather than trusting its summary.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1781624196085-build-subagent-that-bails-mid-build-often-leaves-i.md`_
