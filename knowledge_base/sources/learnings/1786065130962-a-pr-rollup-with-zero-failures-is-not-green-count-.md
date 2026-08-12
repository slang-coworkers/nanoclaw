# A PR rollup with zero FAILUREs is not green — count the NON-SKIPPED checks (a draft PR's build path is filtered out)

A supervisor tick told me slang PR #12294 was "CI-green but BEHIND ⇒ rebase, then mark ready for review." Both halves of that premise were wrong, and the green half is the dangerous one.

**The measurement.** `gh pr view <n> --json statusCheckRollup` returned **47 checks: 42 SKIPPED, 4 SUCCESS, 1 with an empty conclusion and a null name**. Filtering for `FAILURE|CANCELLED|TIMED_OUT` returned `[]` — which is exactly what a genuinely-green PR looks like. But the 4 that actually ran were `board-sync / board-sync` (×2) and `reuse-compliance-check` (×2) — pure bookkeeping. **Zero build jobs, zero test jobs, zero macOS.** Nothing failed because almost nothing executed: the PR is a **draft**, and slang's `ci.yml` filter gate (`github.event.pull_request.draft != true`) skips the whole `pull_request` build path.

**Rule:** "no failing checks" and "CI validated this diff" are different claims. Before reading a rollup as green, compute `non_skipped = total - skipped` and look at *which* checks those are. If the non-skipped set contains no build/test job, the rollup carries **no** signal about the code. On a draft PR the real build evidence lives in a separate `workflow_dispatch` run, not in the PR rollup — don't conflate them.

Two adjacent traps in the same output:
- A check with an **empty `conclusion` and `name: null`** sits in the rollup. `group_by(.conclusion)` silently buckets it, and `(.conclusion//"")|test("FAILURE...")` treats it as not-failing. Handle the empty bucket explicitly rather than letting `//""` launder it into "fine".
- `mergeStateStatus: BEHIND` is a real fact (here: 45 commits) but says nothing about whether CI ran. Don't let a true BEHIND lend credibility to an untrue "green".

**And the action was gated anyway.** `gh pr ready` is operator-gated in my setup, and this PR was deliberately held as a *draft offer* to the maintainer who owns the entangled design work. Flipping it ready would convert deference into a competing merge demand. A remedy that is mechanically sensible ("rebase to get a clean base") can still be wrong for the PR's *purpose* — a parked offer gains nothing from a clean-base run, and rebasing invalidates the `file:line` citations in its body. Check the artifact's intent, not just its mergeability, before acting on a lifecycle nudge.
