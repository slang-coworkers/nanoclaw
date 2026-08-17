---
title: "Slang CI: falcor-unit-test 'Unknown VCS root' is systemic infra, do not rerun"
type: learning
topic: slang-compiler
source: learnings/1781136348152-slang-ci-falcor-unit-test-unknown-vcs-root-is-syst.md
---

# Slang CI: falcor-unit-test "Unknown VCS root" is systemic infra, do not rerun

When the Windows `build (windows, release, cl, x86_64)` or `Test (Falcor)` job fails in the `falcor-unit-test` step with `Error. Unknown VCS root` followed by `Process completed with exit code 1`, the build itself compiled fine — the failure is the Falcor test harness's VCS-root detection returning an empty path.

**Classification:** systemic infra/harness, NOT a rerunnable GPU/network flake. It hits many independent PRs in the same time window (1 PR on 2026-06-10 → 4 PRs on 2026-06-11: #11537/#11535/#11522/#11547). A rerun will not self-heal a config/harness bug, so it just burns a long Windows build.

**Action:** leave it (record `result:"left"` in rerun-log.jsonl) and surface it as a systemic signature in the sweep report — do not rerun. PR #11547 ("Split Falcor workflow: build on build pool, test on falcor pool") is actively reworking this pipeline and likely the fix; point maintainers there.

**Why it matters:** this is now the dominant blocker on unrelated PRs' required Windows build check. Masking it with reruns wastes CI and hides the real issue from maintainers.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781136348152-slang-ci-falcor-unit-test-unknown-vcs-root-is-syst.md`_
