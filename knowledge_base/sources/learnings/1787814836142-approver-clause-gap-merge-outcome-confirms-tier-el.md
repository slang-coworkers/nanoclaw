---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787807827236-7od77u
written_at: 2026-08-27T07:13:56.142Z
---

# [approver/clause-gap] Merge outcome confirms tier_eligible over-routes bot upstream-syncs (abstain → maintainer merges on sight, 0 reviews)

**Symptom:** slang-coworkers/nanoclaw#1319 ("Sync nv-slangpy with upstream/main") was decided `ABSTAIN_POLICY:CLAUSE_FAIL:tier_eligible` twice (heads 3f25272e8b95, then 6dcd8235da16 after a synchronize). It then **merged at exactly my second decision SHA** (6dcd8235da16, merge commit 254ae0a1bc4d) — merged by `szihs`, the maintainer who signed off the v0-shadow-wide policy — with **zero formal PR reviews**. Merge ⇒ APPROVED-equivalent, so the human "verdict" resolved my abstain by direct approval.

**Root cause (why the clause over-routes):** `tier_eligible` counts the three-dot `base...head` line delta (20,563 lines) as decision surface. For a bot-authored upstream branch-sync that delta is *upstream's already-reviewed work*, not net-new authored code — the real decision surface is ~0 (topology was a clean fast-forward, ahead_by 738 / behind_by 0). So the size cap makes every such sync a **structural, permanent abstain**: it can never clear, always routes to a human, and the human (who owns the sync tooling) merges it on sight without a review. The abstain is *correct given the policy* (shadow mode: human is the real gate, and it routed right), but the predicate is imprecise for this shape.

**How to catch it / what's transferable:** Recognize the bot-upstream-sync shape early — bot author + `sync/upstream-*` head + three-dot `behind_by 0` clean fast-forward + huge line delta concentrated in vendored/upstream paths. This shape is the *intended* tier_eligible abstain, and its human resolution is a fast direct maintainer merge with no review. This is now confirmed by a real merge outcome, not just the a-priori topology read. Connects to prior learnings: "git topology is not risk" and "a moved head does not imply changed content (3-for-3 over-conservative on import/sync PRs)."

**Fix:** Do NOT loosen my own derivation to compensate (the n≥3 rule: over-conservative-on-a-shape is a question about the BAR, escalated to the human, never absorbed into the clause reasoning). The v0-shadow-wide `_comment` already flags that size caps must be set empirically from measured precision-vs-size before enforcement — this merge is one more data point that the cap should discount fast-forward-only upstream-sync churn (e.g. gate on net patch-id surface, or exempt clean-fast-forward bot syncs from the line cap) rather than counting pulled-in upstream commits. Compensating control until then: the approver's report already surfaces topology (fast-forward, ahead/behind) + CI + protected paths so the human merge is a 30-second call, which is what happened here.
