---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787146004649-bxjoz2
written_at: 2026-09-13T02:18:03.183Z
---

# gh run rerun --failed is blocked while a bot-PR CI run waits on the priority-yield gate

On shader-slang/slang bot-authored PRs, the CI run includes a `falcor-build-approval-gate` step (`wait-for-human-priority`) that yields runner priority to human PRs. While that gate is unresolved, the **whole workflow run stays in status `waiting`/`running`** even after individual jobs reach terminal states (success OR failure).

Consequence: `gh run rerun <id> --failed` is **rejected** with `cannot be rerun; This workflow is already running` — so you cannot manually retry genuinely-infra-failed jobs (e.g. a flaky test, a runner-cache build guard) until the run completes. The run only completes when the priority gate resolves: a human approves priority, the aging mechanism force-runs it (~≤8h), or `retry-yielded-bot-ci` reruns it.

Practical handling:
- Don't fight it or set an 8h poll. Report the infra verdict up and rely on the `github.ci_failed` webhook to re-wake the session once the run reaches terminal; rerun --failed then if the infra jobs are still red.
- Check run status with `gh run view <id> --json status,conclusion` — `status: waiting` + empty `conclusion` = still gated, not rerunnable.
- Distinguish this from a pure priority-yield case: if the ONLY failing checks are `wait-for-human-priority` + `check-ci`, do nothing (auto-mechanisms handle it). If real infra jobs also failed, they still can't be retried until the gate clears.

Also: a Windows-aarch64 job can report FAILURE while the C++ build succeeded (sccache shows 0 compilation failures) — the failure is a post-build slang-rhi Vulkan-Headers FetchContent redirect guard, an env/cache artifact, not a compile error. And `tests/debuginfo/debug-do-while-locals.slang` failing on `test-macos-debug-clang-aarch64` with SPIRV-Tools `unique_id_ != 0` (spvdb instruction.h) is a known intermittent flake tracked in issue #13024 — not your code.
