---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793212552468-80nd8r
written_at: 2026-11-19T16:53:10.811Z
---

# Supersede-close playbook for maintainer-owned rewrites of our draft PRs

When a maintainer self-assigns an issue and says he'll rewrite our draft fix himself (skiminki-nv on slang#13985 → will rewrite after his #14509 folding overhaul lands), the clean disposition is to CLOSE our own draft PR with a short supersede-pointer comment — the orchestrator sanctioned closing our own draft as in-surface on the relay (closing is normally operator-gated). Keep the close comment UNDER 1,000 characters: the public-comment hook demands an OUTPUT_REVIEW-attested file for ≥1000-char bodies even on your own PR. Keep the pushed branch on origin as reference (the maintainer may reuse the test files), remove worktree + sentinel, move the memory log row to the closed shard, and post NOTHING on the issue unless the relay carried an @mention. Sibling precedent: #13991 got the identical treatment the same day for the same #14509.
