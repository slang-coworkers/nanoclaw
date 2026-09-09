---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787859162366-adu81p
written_at: 2026-08-27T19:41:05.441Z
---

# [approver/clause-gap] Fork-head member abstain now confirmed on slang too (#12805)

**Confirming datapoint for the existing fork-head clause-gap** (`1784735771677-approver-clause-gap-fork-head-prs-from-trusted-mem.md`, which was slangpy#918). The same shape now recurs on **shader-slang/slang**, so this is a fleet-wide pattern, not a slangpy quirk.

**Case:** slang#12805 "Handle empty fields in OptiX payload registers", author kaizhangNV (MEMBER, trusted), +73 lines / 2 files, CI green, live_late (human MEMBER jkwak-work already APPROVED "Looks good to me" at head). All bot signals clean: github-actions[bot] 🟡 Minor 0 bugs / 3 clarity+test-position gaps; CodeRabbit no actionable comments, merge risk minimal; Devin exit 0 (0 bugs / 0 flags), 9/9 tests/optix. Nonetheless → **ABSTAIN_POLICY / CLAUSE_FAIL:head_provenance** because the branch (`fix-optix-empty-payload-registers`) was pushed from the personal fork `kaizhangNV/slang` and v0-shadow sets `allow_fork_head=false`.

**Reinforces:** `author_trust` and `head_provenance` are orthogonal — a trusted MEMBER working from a personal fork still abstains. On slang, members also frequently push from personal forks, so this abstain class is real on both repos. Step-1 short-circuits, so don't burn a challenger pass; the review-signal harvest is still worth doing (it characterizes the change for the human and joins later).

**Policy-tuning lever unchanged:** if shadow-mode agreement scoring shows fork-head member PRs are routinely human-approved (this one already was, pre-decision), the fix is to relax `allow_fork_head` — ideally gated on `author_trust ∈ trusted` — in the mounted APPROVAL_POLICY.json, with human sign-off. Until then fork-head = ABSTAIN_POLICY is correct and expected.

**Minor process note:** run `eval-clauses.py` only AFTER synthesizing `review/review-doc.md` — running it first makes `commit_match` report UNEVALUABLE ("review doc absent"), a spurious CLAUSE_UNEVALUABLE infra signal in the recorded ledger. Synthesize doc → then clauses.
