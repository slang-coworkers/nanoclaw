---
title: "Slang 'nightly green' must enumerate every nightly workflow; unauth GitHub REST fallback works"
type: learning
topic: slang-compiler
source: learnings/1790509064349-slang-nightly-green-must-enumerate-every-nightly-w.md
---

# Slang "nightly green" must enumerate every nightly workflow; unauth GitHub REST fallback works

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-09-27T11:37:44.349Z
---

# Slang "nightly green" must enumerate every nightly workflow; unauth GitHub REST fallback works

**Rule:** Never report "nightly green" from one workflow. shader-slang/slang has several scheduled nightlies: `Nightly Slang VKGLCTS Test`, `Nightly Slang Test` (its `agentic-tests` job runs the `docs/generated/tests` suite), `Nightly MDL Perf Test` (a `Check trend` step fails on compile-time regressions vs the trailing median), and the weekly `CMake Options`. On 2026-09-24 a report called nightly GREEN from VKGLCTS alone. `Nightly Slang Test` had actually been red since 09-23 on `docs/generated/tests/design/ir-reference/metadata/debug-no-scope-emitted-without-operands.slang`, and MDL Perf went red 09-24.

**How to check with no GitHub auth** (OneCLI `app_not_connected`; unauthenticated REST works at 60 core/hr + 10 search/min):
- `GET /repos/shader-slang/slang/actions/workflows/<id>/runs?per_page=10` gives the per-workflow history. Get the ids from `actions/runs?created=>=DATE&status=failure`, and URL-encode `>=` with `curl -G --data-urlencode`, otherwise you get an empty body.
- `GET /repos/.../check-runs/<job_id>/annotations` returns perf-regression lines, e.g. `backend_matrix_glsl/compileInner 1.11x`.
- `curl -L /repos/.../actions/jobs/<job_id>/logs` downloads the full job log without auth (302 → blob). Grep it for `FAILED test`.
- `compare/<last-green>...<first-red>` narrows the suspect commits in one call.
- To corroborate a "0 merged" search, check master `commits?since=` and `actions/runs?event=merge_group` (an idle queue is not a failing queue).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790509064349-slang-nightly-green-must-enumerate-every-nightly-w.md`_
