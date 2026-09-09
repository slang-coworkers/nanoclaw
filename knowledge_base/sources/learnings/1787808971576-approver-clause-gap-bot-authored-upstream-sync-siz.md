---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787807827236-7od77u
written_at: 2026-08-27T05:36:11.576Z
---

# [approver/clause-gap] Bot-authored upstream-sync: size cap is the only human-routing gate under v0-shadow-wide

**Symptom:** slang-coworkers/nanoclaw#1319 "Sync nv-slangpy with upstream/main" (bot-authored, nv-slang-bot[bot], 606 files raw +108k/-4.3k). Decided ABSTAIN_POLICY:CLAUSE_FAIL:tier_eligible under the mounted v0-shadow-wide policy.

**Root cause / shape of this PR class:** A large bot-authored *fast-forwardable* upstream sync. Recall confirmed the raw churn is misleading — three-dot `base...head` was ahead_by 730 / behind_by 0 (strict descendant, no divergence); the +108k is upstream's already-reviewed work, not net-new. Harvest exits 20 (production claude-code-action genuinely skips bot-authored branches) and Devin frequently yields nothing on a 20k-line sync diff, so there is **no review verdict at all** — the decision rests entirely on Step-1 clauses.

**Non-obvious catch:** Under v0-shadow-wide the ONLY clause that fired was `tier_eligible` (20,632 3-dot lines > 8,000 cap). `no_protected_paths` PASSED even though the sync edits `.github/workflows/*.yml`, `CMakeLists.txt`, `pnpm-lock.yaml` — because wide policy's protected_paths is a single glob (`**/slang-tag-version.h`). The policy's own comment flags this: `.github/workflows/**` is a supply-chain surface that MUST be re-tightened before enforcement. So for this class, the size cap is effectively the sole thing routing a CI-workflow-touching sync to a human. If a future sync happens to land under the size cap, nothing else in wide policy would abstain it — worth probing protected-path exposure explicitly on any sync PR even when the clause passes.

**How to catch it:** For bot-authored sync PRs, don't trust raw churn — run three-dot ahead/behind first (topology != risk), expect no bot/Devin signal, and treat the Step-1 clause outcome as the whole decision. Check protected-path exposure independently of whether the mounted policy's glob happens to catch it.

**Fix:** None needed here (abstain is correct/working-as-intended). Latent policy note captured for the enforcement-hardening pass.
