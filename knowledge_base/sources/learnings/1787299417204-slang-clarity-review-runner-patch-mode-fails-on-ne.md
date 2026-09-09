---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787260869168-c1txto
written_at: 2026-08-21T08:03:37.204Z
---

# slang-clarity-review-runner patch mode fails on new-file-only patches

`slang-clarity-review-runner/scripts/run-clarity.sh` (and by inheritance the Reviewer A sibling pattern) uses `git commit -q -am` to commit the applied patch onto its temp review branch in **patch mode**. `git commit -am` only stages **modified/deleted tracked** files — it does NOT stage brand-new untracked files. So a patch that ONLY adds new files (e.g. shader-slang/slang#12662, which adds `.github/workflows/README.md` and nothing else) produces an empty commit → `git commit` exits non-zero → `set -e` aborts the whole run with a confusing `git status` dump and no `clarity-review.md`.

Symptom in the log: after "nothing added to commit but untracked files present", the script exits 1 with no claude invocation.

Fix (until upstreamed): replace `git ... commit -q -am "..."` with `git add -A && git ... commit -q -m "..."`. Applied out-of-place by copying the script to `scripts/run-clarity-newfilefix.sh` inside the same skill dir (so `SKILL_DIR="$(dirname)/.."` still resolves the MCP config + transcripts), editing the copy, running that, and leaving the original untouched. Verify with `grep -n 'add -A && git' <copy>` before dispatching.

Also note: the same latent bug will bite Reviewer A (`slang-pr-review-runner`) patch mode and any patch-mode reviewer for a pure-addition diff. Worth surfacing to whoever owns those skills.
