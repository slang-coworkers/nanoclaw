---
title: "[approver/clause-gap] Branch-sync PR into the approver's own framework repo = OUT_OF_SCOPE + COI, abstain pre-clause"
type: learning
topic: review-approval
source: learnings/1788878652241-approver-clause-gap-branch-sync-pr-into-the-approv.md
---

# [approver/clause-gap] Branch-sync PR into the approver's own framework repo = OUT_OF_SCOPE + COI, abstain pre-clause

---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788878359093-xx203f
written_at: 2026-09-08T14:44:12.241Z
---

# [approver/clause-gap] Branch-sync PR into the approver's own framework repo = OUT_OF_SCOPE + COI, abstain pre-clause

**Symptom:** A reviewable-PR webhook routed `slang-coworkers/nanoclaw#1468` ("Sync nv-slangpy with nv-main 533ccf6d", `nv-slangpy <- nv-main`, bot-authored, 119 files/+8328-919) to the slangpy approver. Nothing in the Step-1 clause script checks repo *identity*, so the machinery would have happily run and (per the rebase/branch-sync learning) `compare/base...head` would have manufactured misleading protected-path/size hits, most likely surfacing only `tier_eligible` fail — masking the real problem.

**Root cause:** Two overlapping scope defects, both prior-known: (1) the approver is calibrated for `shader-slang/slangpy` — `nanoclaw` is the agent-framework repo, i.e. **my own harness**; (2) the sync's changed paths span `container/` (57), `.claude/`, `.github/`, `src/`, `setup/`, `scripts/` — the coworker-type skills/spines/providers/config that PRODUCE my review signal and the RULES I decide by (approver skill + APPROVAL_POLICY.json + workflows). Deciding it = deciding on my own decision instrument = conflict of interest.

**How to catch it:** Before any merits/clause work, ask the two prior-learning questions: is `context.repo` the approver's domain repo? and do the changed paths include the instrument that produces my review signal or the rules I decide by? A branch-sync/`Sync ... with ...` title + a base like `nv-slangpy` + a bot author + labels like `area/skills`,`area/providers`,`area/configuration` are the tells. Confirm from the artifact (`gh pr view --json`), not the tasking framing.

**Fix:** ABSTAIN_POLICY with `reason_code=OUT_OF_SCOPE:repo`, short-circuit BEFORE clauses/harvest/Devin/challenger, and flag the gap upward — do NOT stretch an unrelated clause (e.g. `tier_eligible`) to launder a scope/COI abstain into a clause fail. Operational facts confirmed this run: `OUT_OF_SCOPE:*` is not in SKILL.md's reason_code enum but the `record_decision` MCP tool accepts it and also accepts a cross-domain `repo` value (row written for `slang-coworkers/nanoclaw`). Abstain rows are not critique-gated, so record directly + send `[Approval Decision]` + report up. Nothing posted to GitHub.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1788878652241-approver-clause-gap-branch-sync-pr-into-the-approv.md`_
