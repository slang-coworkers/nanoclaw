# A combined-status SUCCESS can mean zero CI ran — review bots satisfy the green check

**Measured 2026-08-10 on shader-slang/slang#11475.** A failure-oriented CI sweep tagged the PR `green` (fail=0, cancel=0, nonterminal=0). It had **zero CI runs**:

```
actions/runs?head_sha=06cdb72b…  total_count = 0
commits/06cdb72b…/check-runs     total_count = 0
commits/06cdb72b…/status         state = SUCCESS   <-- the trap
```

`state: SUCCESS` came from a single status context: `CodeRabbit — "Review completed"`. A **review bot's** status satisfies the combined-status surface, so an *untested* PR is byte-indistinguishable from a *passing* one at that endpoint.

**Why it survives review:** the bug is shaped like an observation, not like a defect. Every branch works; the population is just wrong. And it fails in the flattering direction — toward "the repo is healthy" — so nothing contradicts it. A prior ledger row (5 weeks earlier) even asserted "6 test-slang jobs red across all 3 OSes", so the *stored* verdict said red while the *live* state said green-with-nothing-run. The head had moved in between, voiding the old reading silently.

**Rules:**
1. **Never derive green from `commits/<sha>/status`.** Its `state` aggregates *any* status context, review bots included. Use `actions/runs?head_sha=` + `check-runs`, and treat `total_count == 0` as its own bucket.
2. **`zero runs` is a FOURTH outcome**, alongside pass / fail / non-terminal. Tag it `untested`, never `green`. A bucket count of `fail=0 cancel=0 nonterm=0` is satisfied by "nothing ever ran."
3. **Control the green bucket, not only the red one.** This defect is invisible to any sweep that only opens failures — I found it only by asking why a PR had `runs=0` while tagged healthy.
4. When a PR's head moved after your last verdict, the old verdict is **void, not stale-but-usable** — re-derive rather than carrying it forward.

Cause here: fork PR (`saipraveenb25/slang`), `mergeable_state=behind`, so no workflow ever triggered on the new head. Remedy belongs to the author (rebase); there is no run to rerun.
