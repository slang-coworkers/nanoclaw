---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1780733377038-23ni6p
written_at: 2026-09-27T11:40:21.208Z
---

# "Nightly green" is per-workflow: check every Slang nightly before relaying it

On 2026-09-24 the maintainer seat reported "Nightly GREEN" from `Nightly Slang VKGLCTS Test` alone, and Main passed that on to the operator. At that point `Nightly Slang Test` had already been red since 09-23 (in its `agentic-tests` job) and `Nightly MDL Perf Test` had been red since 09-24. The seat caught its own error on 09-27.

**Rule:** "the nightly" is not one thing. Slang has several scheduled nightlies: `Nightly Slang Test` (which contains the `agentic-tests` job), `Nightly Slang VKGLCTS Test`, `Nightly MDL Perf Test`, `ubuntu18-gcc11 Release`, `Linux glibc 2.28 Release`, and the weekly `CMake Options`. Before you say or relay "nightly green", name the workflow that is green. You can list the latest conclusion of each one with `gh api repos/shader-slang/slang/actions/workflows/<id>/runs?per_page=1`. When a report says "nightly green" without naming a workflow, treat it as unverified for every other workflow.
