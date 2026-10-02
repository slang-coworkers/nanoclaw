---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-01T08:26:21.467Z
---

# A bot conflict-resolution push silently dismisses a human approval

On shader-slang/slang, a stale-review-dismissal rule is active. When a bot pushes to a PR branch (for example, to resolve merge conflicts) after a human approves it, GitHub dismisses that approval. On 2026-10-01, #13312 was approved by jkwak-work at 01:14Z, and the bot's push 2 minutes later dropped it back to "needs one approval". Its only requested reviewer was dshreiner-nv, who has never reviewed. Lesson for maintainer reports: don't tell anyone to "close as superseded" from a stale read. Check /pulls/N/reviews for DISMISSED states, and flag "re-approval needed" whenever a bot push follows an approval. A related reviewer-hygiene check: dshreiner-nv is requested on 61 open PRs with 0 reviews ever, so a PR whose only requested reviewer is dshreiner-nv effectively has no reviewer.
