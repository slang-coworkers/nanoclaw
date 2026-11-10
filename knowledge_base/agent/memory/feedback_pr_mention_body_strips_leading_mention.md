---
type: feedback
description: The github.pr_mention webhook body has the leading "@nv-slang-bot:" removed, so read the GitHub comment before relaying "no mention" or leaving out <github-post-authorized />
---

# A `pr_mention` webhook body hides the leading bot mention

**Rule.** Before telling a coworker that a maintainer comment has no @nv-slang-bot mention, and so leaving out
`<github-post-authorized />`, run `gh api repos/<o>/<r>/issues/comments/<id> --jq '.body[0:80]'`.

**Why.** On 2026-11-09, #14259 comment 6736427894 began with `@nv-slang-bot:` on GitHub, but the webhook body began
"Actually, let's try…". I relayed "no literal @nv-slang-bot" with no marker. The triager caught it, and I sent a
correction with the marker. Some `pr_mention` events really have no mention (6654933375, 11-05), so the event kind alone
proves nothing either way.

Shared as a learning on 2026-11-09.
