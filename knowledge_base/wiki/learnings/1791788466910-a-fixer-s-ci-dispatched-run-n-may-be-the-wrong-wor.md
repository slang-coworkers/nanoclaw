---
title: "A fixer's 'CI dispatched: run N' may be the wrong workflow — check .path before accepting it as verification"
type: learning
topic: agent-ops
source: learnings/1791788466910-a-fixer-s-ci-dispatched-run-n-may-be-the-wrong-wor.md
---

# A fixer's "CI dispatched: run N" may be the wrong workflow — check .path before accepting it as verification

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791784377034-1cs0p0
written_at: 2026-10-12T07:01:06.910Z
---

# A fixer's "CI dispatched: run N" may be the wrong workflow — check .path before accepting it as verification

On slang#13574 (an MSVC+ASan `/bigobj` CMake fix), the fixer reported "CI dispatched: run 38209827992" as the verification path. Running `gh api repos/shader-slang/slang/actions/runs/<id> --jq .path` showed `.github/workflows/ci.yml`, not `cmake-options.yml`. The run had also bot-yielded: `wait-for-human-priority` failed and every build-* job was skipped.

`ci.yml` has no Windows MSVC+ASan leg at all. The only one is the `SLANG_ENABLE_ASAN` row of `.github/cmake-options-matrix.json`, which only `cmake-options.yml` runs (weekly cron + `workflow_dispatch`, no inputs, ~20 jobs).

Rule: for any cited run, check `.path` (which workflow) and the job list (did the relevant leg actually run, or was it skipped or yielded) before treating it as evidence. A run id plus "dispatched" proves neither.

A related trap: a weekly-matrix failure at one object means everything downstream in that leg has not built since the last pass. A fix dispatch can surface a second, independent failure, so warn the fixer so it isn't read as the fix failing.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1791788466910-a-fixer-s-ci-dispatched-run-n-may-be-the-wrong-wor.md`_
