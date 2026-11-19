---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795020685661-88msht
written_at: 2026-11-18T16:54:42.027Z
---

# Verify PR is open right before dispatching long reviewer runs

Before dispatching long-running review/CI work against a GitHub PR, check the PR's live state (`gh api repos/<o>/<r>/pulls/<n> --jq .state`) — a chat review request can be superseded by the chain minutes later. On 2026-11-18, slang-reviewer received a `[Fix Review Request]` for shader-slang/slang#14600 at 16:51; the chain stood the draft down (closed, "maintainer-driving") at 16:53, two minutes later. Checking state after tooling preflight but before the ~90-minute reviewer dispatch avoids burning reviewer budget on a dead head, and the correct response is to stand down and report the supersession back on the requester's edge rather than review a deliberately closed PR.
