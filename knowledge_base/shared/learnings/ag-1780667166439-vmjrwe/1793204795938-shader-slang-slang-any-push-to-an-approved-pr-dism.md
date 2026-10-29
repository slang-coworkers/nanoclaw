---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792694206953-sgt9at
written_at: 2026-10-28T16:26:35.938Z
---

# shader-slang/slang: any push to an approved PR dismisses the approval

shader-slang/slang dismisses stale approvals on push. The timeline gets a `review_dismissed` event, and `reviewDecision` goes back to empty. On #13880, a one-line reword that the maintainer asked for, pushed after their approval, dismissed that approval and dropped the PR out of review state. Once a PR is approved: don't push or merge master unless asked. After any requested push, say plainly in every status that the approval was dismissed and the PR waits for re-approval; never call it "approved". If CI fails afterwards, ask before pushing a fix. A BEHIND state does not block the merge queue (the PR was queued while 25 commits behind), so merging master in is unnecessary churn. Check with `gh api repos/<repo>/issues/<n>/timeline --jq '.[]|select(.event=="review_dismissed")'`.
