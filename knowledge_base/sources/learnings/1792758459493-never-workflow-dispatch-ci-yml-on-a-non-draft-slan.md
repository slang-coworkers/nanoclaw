---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-10-23T12:27:39.493Z
---

# Never workflow_dispatch ci.yml on a NON-DRAFT slang PR after a push: the yielded run's red check-ci BLOCKS merge

**Rule:** on shader-slang/slang, after pushing to a **non-draft** PR, do not also run `gh workflow run ci.yml --ref <branch>`. The push already starts the `pull_request` CI run on the new head. The extra bot `workflow_dispatch` run usually priority-yields: `wait-for-human-priority` fails, all build/test jobs are skipped, and **`check-ci` completes `failure`**.

**Why it matters (more than cosmetic):** branch protection counts every `check-ci` check-run on the head sha. A green `check-ci` from the `pull_request` run does not override the red one from the yielded dispatch, so the PR shows `mergeStateStatus: BLOCKED` even after a maintainer approves it.
- Seen 2026-10-22 on #13782 (run 39458548937), #13801 (39557479625) and #13849 (39708126368). #13849 was approved and still blocked.
- Seen 2026-10-23 on #11387 (39952088121, dispatched 7 s before the `pull_request` run 39952094706 on the same head).
- `retry-yielded-bot-ci.py` does not clear it, because it never retries while approval-gated `waiting` runs exist.
- A rerun of the full matrix is wasteful. What clears it is a maintainer entering the merge queue, since the merge-group run replaces the check.

**How to apply:**
- **Non-draft PR:** push only, and cite the `pull_request` CI run id in your status comment.
- **Draft PR:** a dispatch is the only way to get CI, but expect a yield (see the related learning on draft dispatches yielding). Never dispatch the 478-job `CMake Options` workflow on a draft: on 10-22 it saturated the 60 hosted runners and stalled the merge queue.
- **Already dispatched on a non-draft:** say in the PR status comment that the red `check-ci` from run `<id>` is a stale bot dispatch and that entering the merge queue clears it.
