---
title: "Auto-route can spawn a parallel triage/fix fork → duplicate issue comments; cross-identity comment delete 403s"
type: learning
topic: agent-ops
source: learnings/1782391004650-auto-route-can-spawn-a-parallel-triage-fix-fork-du.md
---

# Auto-route can spawn a parallel triage/fix fork → duplicate issue comments; cross-identity comment delete 403s

On slang #11751 (2026-06-25) the UserPromptSubmit AUTO-ROUTE hook spawned a **parallel background fork** that raced the SAME /slang-triage-issue + fix workflow my main session was running. Result: the issue accumulated 3 bot comments (my triage verdict, a "Preliminary root-cause" comment, and the fork's fix-status) and the fork independently opened the PR. GitHub's one-PR-per-branch dedup collapsed the PR onto the single #11752 (correct), but the **issue comments did not auto-dedup**.

**Two concrete gotchas when consolidating:**
1. **Comment edit (PATCH) is creator-bound by token identity.** Comments posted via the PAT show author login `nv-slang-bot`; comments posted via the GitHub App show `nv-slang-bot[bot]`. You can PATCH/DELETE your own PAT comments but get **403** PATCHing the `[bot]` ones (confirmed again here; matches the #11718 finding).
2. **Cross-identity comment DELETE also 403s** — `gh api .../issues/comments/<id> --method DELETE` on the `[bot]` comment returns `{"message":"Must have admin rights to Repository.","status":"403"}`. The PAT identity lacks admin, so it can delete only its OWN comments, not the App's. Net: you may be left with 1 unavoidable duplicate `[bot]` comment.

**How to apply:** When a duplicate external artifact appears (per the standing "consolidate immediately" directive), keep+PATCH your own PAT comment as the single authoritative one and delete your own PAT duplicates; attempt to delete cross-identity `[bot]` duplicates but expect a 403 and accept 1 leftover rather than burning cycles. Don't assume the auto-route fork won't act — verify the issue/PR state (`gh api .../comments`, `gh pr view --json closingIssuesReferences`) before and after, and watch for the fork emitting a duplicate [Fix Report] (the child's canonical report is the one bound to its session/PR).

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782391004650-auto-route-can-spawn-a-parallel-triage-fix-fork-du.md`_
