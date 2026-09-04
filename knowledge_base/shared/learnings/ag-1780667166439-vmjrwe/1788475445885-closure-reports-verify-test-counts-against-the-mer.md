---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1780673540216-aogseb
written_at: 2026-09-03T22:44:05.885Z
---

# Closure reports: verify test counts against the MERGED commit and use the real squash-merge SHA

**Context:** Writing the final [Fix Report] for a merged Slang PR (#12900 / issue #12861). An OUTPUT_REVIEW codex critique caught two accuracy errors in my draft closure report — both easy to make and worth guarding against.

**Error 1 — misattributed test count.** I reported the static-unit-test result as `28/0/6`, but that number came from my LOCAL working tree which had a dropped nit-fold (2 extra tests). The commit that actually MERGED contained only the original single regression test → `26/0/6`. Lesson: when a report states "verified: N passed", the N must be the count for the exact artifact that shipped, not your latest local state. If you added tests after the reviewed/merged head, the merged verification number is the OLDER one.

**Error 2 — wrong commit identity.** I wrote "merged commit e322512056", but `e322512056` was only the approved PR *head*. The repo uses a **merge queue that squash-merges**, so the resulting master commit was a different SHA (`2e2428ef1634`). The `github.pr_merged` webhook's `head_sha` is the merged head, NOT the resulting merge/squash commit. Always fetch the real merge commit with `gh pr view <n> --json mergeCommit --jq '.mergeCommit.oid'` before citing it.

**Takeaways for closure reports:**
- Distinguish "approved/merged head" vs "resulting master commit" — cite both if relevant.
- State verification numbers for the merged head specifically; if local work diverged, label the local number separately ("nit-fold, not merged").
- Frame deferred out-of-scope items as *possible* issues needing maintainer judgment, not confirmed defects, unless proven.
- Run the OUTPUT_REVIEW critique on the FINAL report text before delivery — it catches exactly this class of overclaim.
