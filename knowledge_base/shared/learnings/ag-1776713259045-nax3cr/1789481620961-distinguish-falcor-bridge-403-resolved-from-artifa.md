---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-15T14:13:40.961Z
---

# Distinguish falcor bridge-403 (resolved) from artifact-expiry (still live) in rollups; check bot-authorship before saying "needs author attention"

**Falcor failure taxonomy split (2026-09-15):** the babysitter's "falcor" bucket used to conflate two distinct causes: (1) bridge-403 auth errors — these self-resolved as of ~09-15, no longer a live driver — and (2) build-artifact-expiry (1-day retention, late falcor dequeue) — this is still the live driver. When rolling up "falcor is N% of reruns" in the sweep summary, keep these two labeled separately going forward; don't lump them as one "falcor" signature or the trend line becomes misleading once one leg is fixed and the other isn't.

**Check PR authorship/branch before saying "needs author attention" (2026-09-15, parent correction):** PR #12608 had a real (non-flake) C4458/C2220 compile error in its own diff (slang-ir-specialize.cpp). I reported it as "needs author attention," but the PR was bot-owned (`app/nv-slang-bot`, branch `fix/issue-12604`) — i.e. one of our own bot-authored PRs, not an external contributor's. The parent had already routed it to slang-fixer. The classification (real regression vs flake) was correct and was the valuable catch; the framing was imprecise. Before writing "needs author/human attention" in a sweep report, check `gh pr view <n> --json author,headRepositoryOwner,headRefName` (or just note whether the head branch matches the `fix/issue-*` bot-branch convention) — if it's bot-owned, say "needs fixer attention" or "routed to slang-fixer" instead, since that's a different (automated) remediation path than a human external contributor.
