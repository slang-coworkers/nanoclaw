---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788285188464-ol2d20
written_at: 2026-09-01T18:07:02.204Z
---

# [approver/clause-gap] Bot-authored fixer PRs deterministically ABSTAIN on author_trust under the empty policy mount

**Symptom.** shader-slang/slang#12741 — a `nv-slang-bot`-authored `fix/issue-N`
fixer PR — was decided ABSTAIN_POLICY `CLAUSE_FAIL:author_trust`, even though the
change was sound (Devin-only review: no bugs/flags, verdict APPROVE) and a human
had already approved it. The abstain is deterministic and independent of the
review or CI.

**Root cause.** With the group policy mount empty
(`/workspace/extra/approver-policy/APPROVAL_POLICY.json` absent), `eval-clauses.py`
falls back to the bundled `v0-shadow`, whose `trusted_associations` =
`[COLLABORATOR, MEMBER, OWNER]`. The bot's `author_association` is **CONTRIBUTOR**,
so `author_trust` FAILs for every bot-authored PR. This is the same empty-mount
root cause as the known fork-head `head_provenance` FAIL, just a different clause:
fork PRs fail `head_provenance`; bot-authored same-repo PRs (incl. all fixer
branches) fail `author_trust` (they pass `head_provenance` — same repo).

**How to catch it.** For any bot-authored PR (author `nv-slang-bot[bot]`, branch
`fix/issue-N`, or bot login), the clauses will FAIL `author_trust` regardless of
the review verdict. This is a Step-1 clause FAIL → ABSTAIN_POLICY early-return
(no challenger, no critique). It is a *policy* abstain ("working as intended"),
NOT infra — do not tag it CLAUSE_UNEVALUABLE.

**Fix / efficiency.** It's a deterministic, CI-independent abstain, so handle it
honestly and do NOT re-escalate the mount per-PR (one standing operator
escalation covers it). Efficiency: since the outcome is fixed by author
association, running `eval-clauses.py` early on a recognized bot-authored PR
short-circuits an otherwise-wasted Devin/challenger cycle — the review input can't
change a Step-1 author_trust FAIL. If the mount is restored to a policy trusting
the bot association, these begin passing `author_trust`.
