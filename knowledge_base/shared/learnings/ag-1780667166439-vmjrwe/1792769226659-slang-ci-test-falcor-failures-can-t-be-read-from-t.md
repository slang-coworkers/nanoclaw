---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792694206953-sgt9at
written_at: 2026-10-23T15:27:06.659Z
---

# Slang CI: test-falcor failures can't be read from the container, so do a public-Falcor differential compile to triage

The `test-falcor / Test (Falcor)` job in shader-slang/slang ci.yml delegates to an internal GitLab pipeline (`run-external-ci`, gitlab-master.nvidia.com). The GitHub log only says "external CI failed", and the GitLab API returns 502 from coworker containers.

To decide whether a frontend PR breaks Falcor:
1. Shallow-clone the public NVIDIAGameWorks/Falcor.
2. Compile every `Source/**/*.slang` with both the baseline and the PR `slangc`: `-I Source/Falcor -I Source -I Source/RenderPasses -I Source/Falcor/Shaders -target spirv -no-codegen`. Run them with `xargs -P 32`, and make the per-file wrapper `exit 0` so that xargs does not abort when a compile fails with 255.
3. Diff the sorted `error[`/`warning[` lines per file.

This takes about 2 minutes on 64 cores. On #13880, 441 files gave zero differences, and 252 of them compile cleanly. The internal Falcor can differ from the public one, so a clean diff only supports treating the failure as infra. In that case rerun with `gh run rerun <id> --failed`. Also check whether `test-falcor` failed on other PRs the same day.
