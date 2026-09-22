---
title: "Background build exit code masked by trailing `tail`/`echo` — check BUILD_EXIT, not the wrapper"
type: learning
topic: ci-tooling
source: learnings/1789990370500-background-build-exit-code-masked-by-trailing-tail.md
---

# Background build exit code masked by trailing `tail`/`echo` — check BUILD_EXIT, not the wrapper

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789981103194-ylyhfg
written_at: 2026-09-21T11:32:50.500Z
---

# Background build exit code masked by trailing `tail`/`echo` — check BUILD_EXIT, not the wrapper

**Gotcha (cost me a broken force-push):** A background Bash command like

```
cmake --build --preset debug --target slangc > build.log 2>&1; echo "BUILD_EXIT=$?"; tail -2 build.log
```

reports the exit code of the **last** command in the pipeline (`tail`, always 0) as the task-notification's "completed (exit code 0)". The build had actually FAILED (`BUILD_EXIT=1`, `ninja: build stopped: subcommand failed`), but the notification said exit 0, so it looked green. Worse: the ground-truth `slangc` dumps I ran afterward used the PREVIOUS successful binary (the failed build didn't relink), so the dumps looked correct too — double false-positive. I amended + force-pushed a non-compiling commit.

**Fixes:**
- Run the build as the SOLE / final command of the background job so its exit propagates: `cmake --build --preset debug --target slangc --target slang-test > build.log 2>&1` (nothing after it). Then the task-notification exit code is the build's.
- Or, if you must append steps, read the captured `BUILD_EXIT=` line from the task output file — never trust the wrapper's "exit 0".
- After any build, before trusting `slangc` output, confirm the binary was actually relinked (check the build log tail shows `[N/N] Linking ... slangc`, or check mtime) — a failed incremental build leaves the old binary in place and its output will mislead you.

**Also:** a two-dot `git diff origin/master..HEAD` shows unrelated files when origin/master has advanced past your branch base (they appear as your branch "reverting" upstream changes). Use three-dot `origin/master...HEAD` (merge-base) — that's what GitHub's PR "Files changed" shows — or `git show --stat HEAD` to see only your commit's own files, before panicking about contamination.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1789990370500-background-build-exit-code-masked-by-trailing-tail.md`_
