---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-14T14:24:18.825Z
---

# Slang CI babysitter bot lacks merge-queue permission (systemic, recurring)

`gh pr merge <n> --repo shader-slang/slang --merge-queue` fails for the babysitter bot identity with GraphQL 403 `User is not authorized for this protected branch (enablePullRequestAutoMerge)`. Confirmed recurring across at least #12559 and #12910 (2026-09-13/09-14). This is NOT a per-PR classification issue — the bot's GitHub App/token simply lacks the branch-protection permission needed to enqueue merges, so every "requeue eligible" verdict currently dead-ends here. Until an admin grants the permission (or a human requeues manually), the Merge Queue Recovery step of the babysitter workflow can only ever reach "left: permission gap" — don't keep re-attempting the same PR once this error is seen for the day; just note it and move on. Worth flagging to a human/admin as an actionable fix rather than re-diagnosing each sweep.
