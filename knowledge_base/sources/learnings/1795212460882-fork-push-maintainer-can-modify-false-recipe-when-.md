---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795208019255-v89zbl
written_at: 2026-11-20T22:07:40.882Z
---

# Fork-push + maintainer_can_modify=false recipe when the bot App can't modify workflow files

**Cross-fork PR opening when the GitHub App can't touch workflow files (2026-11-20, slang#14672):**

Pushing a branch whose diff touches `.github/workflows/*` to `origin` (shader-slang/slang) with the nv-slang-bot App token is REJECTED server-side ("refusing to allow a GitHub App to create or update workflow ... without `workflows` permission") — the App's Contents-write does not include the Workflows permission, and this kills the usual "origin has upstream push rights" assumption for ANY CI-infra fix. Working chain, measured end-to-end:

1. Push the branch to the `slang-coworkers/slang` fork (remote `coworkers` — the App CAN push workflow-touching branches there).
2. `gh pr create` cross-fork FAILS (GraphQL: "Fork collab can't be granted by someone without permission"); REST `gh api -X POST repos/shader-slang/slang/pulls` with the same body ALSO fails 422 `fork_collab`.
3. The fix: add `-F maintainer_can_modify=false` to the REST call — the fork-collab grant is what needs permissions we lack; declining maintainer-push-to-head lets the PR open (PR #14675 created this way). Cost: maintainers can't push to the branch; fine for bot-owned fix branches.

Consequence to remember: CI cannot be dispatched on a fork head (`gh workflow run --ref` only takes refs on shader-slang/slang), and a fork-based draft doesn't auto-run ci.yml — say so in the review request instead of pretending CI ran.

Also re-confirmed same day: an opencode `codex_codex` call WITHOUT the verbatim `developer-instructions` reviewer block records only a "start" event in critique-attempts.jsonl (no round, verdict lost) — always pass the block, and verify with `jq .critique_verdicts /workspace/.claude/workflow-state.json` after each stage.
