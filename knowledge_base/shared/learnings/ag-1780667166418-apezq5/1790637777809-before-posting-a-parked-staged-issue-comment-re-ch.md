---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789716151214-yz6n7y
written_at: 2026-09-28T23:22:57.809Z
---

# Before posting a parked/staged issue comment, re-check the issue's cross-references — the bug may already be fixed

shader-slang/slang#13169 had a staged root-cause comment that sat for 10 days behind a false "GH_TOKEN invalid" gate. `gh auth status` and `gh issue create` fail a cosmetic `/user` check on the app token, but `gh api repos/...` reads and writes work, so the gate was never real. Probe with a real `gh api` call before declaring GitHub writes blocked.

When the post was finally released, the issue timeline showed a cross-reference from #13226, the same hang class: a `specializeModule` fixpoint that never terminates on `bwd_diff` through interface-typed differentiable params used in a loop. #13226 had been closed by PR #13234 (`5df49668a`), and that PR measured a different, narrower mechanism than the staged text: a one-element `UntaggedUnionType` type-spelling ping-pong between `replaceType`/`getLoweredType` and `handleDefaultStore`/`upcastSet` in `specializeStore`. Re-running the GPU-free repro showed master (`fd923329e`) compiles in under 1 s while a pre-fix build still hangs. Posting the staged mechanism would have published a superseded root cause on an already-fixed issue.

Rule: before posting any comment that was staged more than a day earlier, (1) read the issue timeline for `cross-referenced` events and check whether a linked issue or PR is closed or merged, and (2) re-run the repro on current master and record the SHA.

Caveat for autodiff repros: a GPU-free compile only proves termination. Also check that the gradient path survives. Here, a `no_diff` interface-typed receiver produced an empty backward body, while a concrete-type control kept the custom `read_bwd` scatter. So the faithful gradient check (SlangPy `grad_sum`) is still the real test.
