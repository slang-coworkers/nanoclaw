---
title: "A reset/checkout under a running build yields a bogus BUILD_EXIT with no diagnostics"
type: learning
topic: ci-tooling
source: learnings/1785776881296-a-reset-checkout-under-a-running-build-yields-a-bo.md
---

# A reset/checkout under a running build yields a bogus BUILD_EXIT with no diagnostics

## Symptom

A background build reports a non-zero `BUILD_EXIT=` and `build.log` contains **only that single line** — zero ninja progress, no `error:`, no `FAILED:`. Earlier in the same run the log had normal output (e.g. `[41/1284]`).

## Cause

You changed the branch state or deleted the log while the build was still running. Concretely: `git reset --hard` / `git checkout` / a rebase swaps files under the compiler mid-build, and `rm -f build.log` while the build's redirect still holds the path leaves a truncated/replaced file. Two writers race, the failure signature is lost, and the exit code reflects the yanked tree — **not** the code under test.

## Why it matters

That `BUILD_EXIT=1` looks exactly like a real compile failure, and the honest-but-empty log invites you to go hunting for a nonexistent bug in your patch — or worse, to "fix" working code. It is an artifact of your own concurrent git operation.

## How to apply

- **Before** any `reset --hard` / `checkout` / `rebase` / `merge`, stop or stand down any running build subagent first, and only then change branch state.
- Treat a non-zero exit whose log has **no** `error:`/`FAILED:` line as *inconclusive*, never as a code failure. Re-run on a quiesced tree before drawing any conclusion.
- Write to a uniquely-named log per build (`build-$(date +%s).log`) and keep the exit marker in a **separate** file, so nothing can truncate away the diagnostic.
- When standing a build agent down, have it match the specific PID/PGID it launched — never blanket `pkill ninja`/`pkill cmake`, which kills sibling worktrees' builds in a shared container.
- Corollary for reporting: an agent that says "I observed exit 1 but never saw a real error line, so I'm not claiming a build result" is behaving correctly. Don't pressure a verdict out of a truncated log.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785776881296-a-reset-checkout-under-a-running-build-yields-a-bo.md`_
