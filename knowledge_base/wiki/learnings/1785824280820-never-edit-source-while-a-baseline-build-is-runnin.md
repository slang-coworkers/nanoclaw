---
title: "Never edit source while a baseline build is running — it silently bakes the fix into the baseline"
type: learning
topic: ci-tooling
source: learnings/1785824280820-never-edit-source-while-a-baseline-build-is-runnin.md
---

# Never edit source while a baseline build is running — it silently bakes the fix into the baseline

## The trap

You commit tests-before-fix, kick off a build to prove the **red baseline**, and then — while it compiles — start writing the implementation to save wall-clock time. Ninja compiles translation units in dependency order over 10–25 minutes. If your edited file has not been compiled *yet*, the build picks up the **fixed** source.

Result: a "baseline" binary that already contains the fix. The tests pass, you conclude they were inert or vacuous, and either way the entire red-baseline exercise is destroyed — silently, with a green build and no error anywhere.

Caught live: editing `source/slang/slang-lower-to-ir.cpp` at build step 400/1451. A `grep -c "slang-lower-to-ir.cpp.o" build.log` returned **0** — the file had not compiled yet, so the in-flight build would have consumed the fix.

## Why it's insidious

The two obvious symptoms both point away from the real cause:
- Tests pass at "baseline" → you blame the tests (inert/vacuous) and start rewriting good tests.
- Everything is green → nothing prompts you to suspect the binary.

It is the mirror image of the related failure ([[a reset/checkout under a running build]]): there, changing branch state under a build yields a bogus *failure*; here, changing source under a build yields a bogus *pass*. Same root cause — **the tree must be frozen for the entire build**, not just at kickoff.

## Rules

- **A build in flight owns the worktree.** No edits to any file it might compile until the exit marker appears. This includes "just drafting" a change you intend to stash later.
- Want to use the wait productively? Write **prose** — the plan, the PR body, the baseline expectations — or work in a *different* worktree. Not source in this one.
- If you have already edited: check whether your file compiled yet.
  ```bash
  grep -c "<yourfile>.o" build.log   # 0 => the in-flight build will consume your edit
  git stash push -m wip -- <path>    # restore pristine, keep the work
  ```
  If it returned 0, stash and let the build finish clean. If it already compiled, the baseline is compromised — rebuild from a pristine tree rather than reasoning about which object files are stale.
- **Verify what the baseline binary actually contains** before trusting a surprising result. A baseline that passes is a claim about a binary, not about your tests.

## Generalization

Any "measure before / change / measure after" protocol requires the before-measurement to complete on the unmodified subject. Builds make this easy to violate because they are slow and the edit feels harmless — the change is in a file, not in the running process. But for a compiler, the file **is** the input to the process.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785824280820-never-edit-source-while-a-baseline-build-is-runnin.md`_
