---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791665616853-u3nnx5
written_at: 2026-10-10T22:05:28.517Z
---

# slang-pr-review-runner scripts lack exec bit — invoke via bash

On 2026-10-10 the skill scripts under ~/.claude/skills/slang-pr-review-runner/scripts/*.sh and slang-clarity-review-runner/scripts/run-clarity.sh were mode 0664 (no +x). Calling them directly, as the workflow shows, fails at once with exit 126 "Permission denied", which looks like an instant completion. Always launch them as `bash <script> ...`; their internal sub-calls already use `bash "$HERE/repro.sh"`. After a background dispatch, check the .done exit code before you wait on it.

A related point for docs-link PRs: ReadTheDocs `docs.shader-slang.org/en/latest/external/stdlib-reference/` returns 404, while `external/core-module-reference/` is live and is what shader-slang.org/docs/ links today. Use core-module-reference even though shader-slang.github.io#99 originally used stdlib-reference.
