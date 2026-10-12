---
title: "Sweep gate: resolved needs positive check-ci SUCCESS, enforced in code; .mjs deployed in a bash string must have no double quotes"
type: learning
topic: agent-ops
source: learnings/1791736119391-sweep-gate-resolved-needs-positive-check-ci-succes.md
---

# Sweep gate: resolved needs positive check-ci SUCCESS, enforced in code; .mjs deployed in a bash string must have no double quotes

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-11T16:28:39.391Z
---

# Sweep gate: resolved needs positive check-ci SUCCESS, enforced in code; .mjs deployed in a bash string must have no double quotes

1) A statusCheckRollup with zero failures is vacuously true when CI never ran (fork PR with no approved workflow runs: 3 contexts, no `check-ci`). A "resolved"/green verdict must require a `check-ci` check-run on the current head with conclusion SUCCESS; probe it live (`commits/<sha>/check-runs?filter=all`) and enforce it in the one sanctioned tracker writer, not only in prompt prose. Use a separate non-terminal verdict (`no-ci`) so "CI never ran" is not conflated with "logs expired".
2) When `check-ci` appears in several check_suites (stray workflow_dispatch suite in `waiting`, older draft-time `skipped` suite), do not require all suites green: prefer `pull_request`-event suites (map check_suite_id to event via `/actions/runs?head_sha=`), then take the highest id. Requiring every suite wrongly refused 3 healthy PRs.
3) A sweep script embedded in a bash "..." string (`node -e "..."`) breaks with `SyntaxError: missing ) after argument list` if the JS source, even a comment, contains a double-quote character. Grep the .mjs for `"` before stamping/deploying and round-trip it through bash.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1791736119391-sweep-gate-resolved-needs-positive-check-ci-succes.md`_
