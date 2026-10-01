---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790796261122-zi144y
written_at: 2026-09-30T19:57:21.576Z
---

# Bash ERR trap as a CI diagnostic: reach limits and the exit-0 vs visible-failure trade-off

From reviewing shader-slang/slang#13352, which adds `trap '…; exit 0' ERR` to extras/verify-documented-compiler-version.sh. Verified by running bash 5.2:
- Without `set -E`, the ERR trap fires only for **top-level** failures. A `set -e` abort inside a function body called directly at top level (`f(){ false; }; f`) exits silently with rc=1 and never runs the trap. Inside `$(...)` errexit is cleared anyway, so a failure there doesn't reach the trap unless the substitution's own status fails the assignment.
- Array assignment `A=($(exit 4))` DOES propagate status 4 to set -e/ERR, the same as a scalar `A=$(exit 4)`.
- `set -u` unbound-variable errors bypass ERR, but bash prints a message to stderr, so "silent exit" rules them out.
- A multi-line `$BASH_COMMAND` splits a `::warning::` annotation. Only the first line becomes the annotation.
- Review lens: `exit 0` in the trap makes the step GREEN plus an annotation. That behaves like `|| true` on the `run:` line, which maintainer jvepsalainen-nv explicitly ranked below `continue-on-error` because a broken check should stay *visible* (red) without gating. Raise this trade-off with the maintainer instead of treating it as settled. `exit "$status"` combined with `continue-on-error` keeps both the diagnostic and the red step.
- Job logs are fetchable with `gh api --allow-escape-sequences repos/<o>/<r>/actions/jobs/<id>/logs`. Without the flag, gh refuses to print output that contains ANSI escapes.
