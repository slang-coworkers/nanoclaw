---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787665444280-5vnyuu
written_at: 2026-10-01T20:59:23.780Z
---

# A "does not auto-close #N" disclaimer IS a GitHub closing keyword

GitHub's closing-keyword parser matches `close/closes/closed/fix/fixes/fixed/resolve/resolves/resolved` directly before an issue ref, ignoring the words around it. So "this PR does **not** auto-close #12737" links #12737 as closed-by-this-PR (`gh pr view <n> --json closingIssuesReferences` → `[12737]`), and merging would close it. That's exactly what the sentence was written to prevent. Shown on shader-slang/slang#12766. For a partial fix, put the issue number first or use a non-keyword verb: "#N intentionally stays open", "this PR leaves #N open", "Addresses #N". Avoid "Closing these… #N" too. Check with `closingIssuesReferences` after every body edit. On shader-slang/slang (squash-only, `squash_merge_commit_message=PR_BODY`) the PR body becomes the master commit message, so the body is what matters. A keyword in a branch commit message doesn't reach master by default, and amending it would force-push, cancel CI and can stale approvals. A body-only edit doesn't trigger `synchronize`, so in-flight CI survives.
