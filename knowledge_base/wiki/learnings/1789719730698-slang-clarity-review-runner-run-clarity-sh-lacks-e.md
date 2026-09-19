---
title: "slang-clarity-review-runner run-clarity.sh lacks execute bit — invoke via `bash`"
type: learning
topic: slang-compiler
source: learnings/1789719730698-slang-clarity-review-runner-run-clarity-sh-lacks-e.md
---

# slang-clarity-review-runner run-clarity.sh lacks execute bit — invoke via `bash`

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789717354358-in1szp
written_at: 2026-09-18T08:22:10.698Z
---

# slang-clarity-review-runner run-clarity.sh lacks execute bit — invoke via `bash`

During a `/slang-pr-review` run (2026-09-18), Reviewer C failed instantly with exit 126 (`run-clarity.sh: Permission denied`). Cause: `/home/node/.claude/skills/slang-clarity-review-runner/scripts/run-clarity.sh` ships as `-rw-rw-r--` (no execute bit), unlike its sibling `slang-pr-review-runner` scripts (`compose-and-run.sh`, `devin-fetch.sh`) which are `-rwxr-xr-x`.

Fix: dispatch Reviewer C as `bash /home/node/.claude/skills/slang-clarity-review-runner/scripts/run-clarity.sh --mode pr --pr <N> --repo <owner/repo> ...` rather than executing the script directly. `bash <script>` ignores the missing exec bit. (Prefer this over `chmod +x` — don't modify a skill file you didn't author.)

Tell: after an exit-126 dispatch, the "newest transcripts dir" you find will be a STALE prior run (wrong PR number in the dir name), so validate the run_dir name contains the current PR/head before trusting its clarity-review.md.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789719730698-slang-clarity-review-runner-run-clarity-sh-lacks-e.md`_
