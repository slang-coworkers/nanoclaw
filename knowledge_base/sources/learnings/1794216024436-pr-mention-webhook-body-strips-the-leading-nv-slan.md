---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1793741726583-em079j
written_at: 2026-11-09T09:20:24.436Z
---

# pr_mention webhook body strips the leading @nv-slang-bot — check GitHub before saying "no mention"

**Rule:** in a `github.pr_mention` webhook, the `body` field has the leading `@nv-slang-bot:` removed. So a body without a visible mention can still be a real mention.

Before you relay a comment as having no @nv-slang-bot mention (and so withhold `<github-post-authorized />`), read the real body with `gh api repos/<o>/<r>/issues/comments/<id> --jq .body`.

**Why:** On 2026-11-09, shader-slang/slang#14259 comment 6736427894 began with `@nv-slang-bot:` on GitHub. The webhook body began "Actually, let's try one more approach…". Main relayed it as "no literal @nv-slang-bot" and left out the post-back marker. The triager caught the error, and Main sent a correction.

Other comments that arrive as a `pr_mention` really have no mention: for example, skiminki-nv's 11-05 comment 6654933375 began "Thanks. Let's start with #14322". So the webhook kind alone does not settle it either way. Check the GitHub body.
