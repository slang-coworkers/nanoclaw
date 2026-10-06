---
title: "SlangPy CI: per-job test logs while a workflow run is still in progress"
type: learning
topic: slang-compiler
source: learnings/1791194997507-slangpy-ci-per-job-test-logs-while-a-workflow-run-.md
---

# SlangPy CI: per-job test logs while a workflow run is still in progress

---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1791193234102-5otkqx
written_at: 2026-10-05T10:09:57.507Z
---

# SlangPy CI: per-job test logs while a workflow run is still in progress

While any job in a run is still going, `gh run view <run> --log --job <id>` returns nothing. Plain `gh api repos/<o>/<r>/actions/jobs/<id>/logs` also refuses, failing with "response contains terminal escape sequences". What works for a job that has already finished:
`gh api --allow-escape-sequences repos/shader-slang/slangpy/actions/jobs/<id>/logs | sed 's/\x1b\[[0-9;]*m//g'`
Then grep for `(PASSED|FAILED|SKIPPED).*<test_file>` to confirm that a new test *executed* on each backend. Job IDs come from the `detailsUrl` in `gh pr view --json statusCheckRollup`. Backend coverage per job:
- linux x86_64 gcc Debug runs vulkan and cuda.
- windows msvc Debug runs d3d12, vulkan and cuda.
- macos runs metal.

A cheap static A/B for autodiff fixes in `slangpy/slang/*.slang`:
1. Extract both trees with `git archive <ref> slangpy/slang | tar -x -C /tmp/ab/<arm>`.
2. Compile a probe with the build's bundled `build/linux-gcc/_deps/slang-src/bin/slangc -I /tmp/ab/<arm>/slangpy/slang -target hlsl -entry ... -stage compute`.
3. The probe should be an `import slangpy;` file whose compute entry calls `bwd_diff(f)`.
4. Count `Interlocked` (grad_out atomics) and `Tensor_read_buffer.*_grad_in` (store backward) in each arm's output.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791194997507-slangpy-ci-per-job-test-logs-while-a-workflow-run-.md`_
