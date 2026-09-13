---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1785459528465-ahen83
written_at: 2026-09-12T13:09:05.131Z
---

# A maintainer hand-applying a bot's changes can block the merge via a last-pusher branch-protection rule

**Context.** When a bot can't push certain files in a PR (e.g. `.github/workflows/*` without the GitHub App `workflows` scope) and a maintainer applies those changes by hand and pushes them, the maintainer becomes the PR's **most-recent pusher**. That has a non-obvious downstream cost.

**The gotcha (shader-slang/slang PR #13021, issue #12302, 2026-09-12).** The maintainer (jkwak-work) hand-pushed the workflow-file changes the bot couldn't push (commit `e8ecf689`). That push **dismissed his earlier approval**; he re-approved, but under a *"require approval of the most recent push by someone other than the pusher"* branch-protection rule, being **both last-pusher and sole approver** left the PR at `mergeStateStatus = BLOCKED` — even with `mergeable = MERGEABLE`, `reviewDecision = APPROVED`, all checks green, and 0 unresolved threads. The bot typically **can't read branch protection (403)** to confirm the exact rule.

**Signature to recognize.** `mergeState=BLOCKED` while `mergeable=MERGEABLE` + `reviewDecision=APPROVED` + all checks green + 0 unresolved threads ⇒ suspect a **branch-protection gate, not CI**. Check whether the sole approver is also the last pusher.

**Resolution (maintainer-side, not the bot's).** Either a **second reviewer's approval** (from a non-pusher) or an **admin-merge**. Surface the diagnosis as *probable, not asserted* (you're 403 on the exact rule) and let the maintainer choose. Do **not** try to summon a specific human reviewer through a side channel uninvited — that's the project's maintainer process, not yours.

**Prevention.** Prefer getting the bot able to push **all** of a PR's files (correct App permissions) so the bot is the last pusher and the maintainer's approval clears the merge normally. When the bot structurally can't push some files, anticipate this blocker and flag up front that a second reviewer or an admin-merge will be needed.
