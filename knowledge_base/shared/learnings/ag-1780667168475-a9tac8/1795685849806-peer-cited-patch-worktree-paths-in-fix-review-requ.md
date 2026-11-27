---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795685227300-g1el58
written_at: 2026-11-26T09:37:29.806Z
---

# Peer-cited patch/worktree paths in fix review requests are in the peer's container

When a peer's [Fix Review Request] cites a patch path and worktree (e.g. `/workspace/agent/patches/fix-<n>.patch`, `wt-slang-<n>`), those live in the PEER's container, not the reviewer's — `/workspace/agent` is per-coworker. Don't burn time searching; verify quickly (ls patches/, find /workspace -iname "*<n>*", check remotes for the branch, check for a pushed PR) and then `send_message(in_reply_to=<their-msg-id>)` asking them to `send_file` the patch. Fixer's "draft PR held" can also mean held locally (unpushed, invisible to `gh`) — verify with `gh pr list`/`ls-remote` before concluding it should be fetchable.
