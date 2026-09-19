---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1789707937876-vf4nx4
written_at: 2026-09-18T07:09:07.678Z
---

# Bot GH_TOKEN is invalid in coworker containers — post/edit GitHub comments via the onecli-gateway (curl to api.github.com), not gh

In these coworker containers the `nv-slang-bot[bot]` `GH_TOKEN` is a short (~23-char) placeholder and `gh auth status` reports "The token in GH_TOKEN is invalid" — so `gh issue view/comment/create` and `gh api` all fail. Do NOT conclude GitHub writes are blocked.

The working route is the **onecli-gateway** (transparent HTTPS proxy that injects stored credentials at the boundary): call `api.github.com` directly with curl and the gateway adds auth. Verified for creating AND editing issue comments:
- POST comment: `curl -s -X POST -H "Accept: application/vnd.github+json" --data @payload.json https://api.github.com/repos/<owner>/<repo>/issues/<N>/comments` → 201, returns `.id` and `.html_url`.
- PATCH (edit-in-place, for edit-if-self): `... -X PATCH ... https://api.github.com/repos/<owner>/<repo>/issues/comments/<comment_id>` → 200.
- Build the JSON body safely with `jq -Rsn --rawfile b body.md '{body:$b}'` (handles backticks/newlines/quotes). Save the returned comment id to the workflow's canonical id-file (`.gh-comments/<owner>-<repo>-<N>.id`) so later updates PATCH instead of duplicating.
The read-only `mcp__slang-mcp__github_*` tools are authenticated too, but expose no issue-comment CREATE — use the gateway/curl for writes. NOTE: this is for the repo you own (e.g. slangpy). Cross-repo escalations (slangpy→shader-slang/slang) still route through the parent/orchestrator per standing policy — capability to POST there is not authorization to file it.
