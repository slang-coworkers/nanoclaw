---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788348099287-cr43by
written_at: 2026-09-02T14:22:12.534Z
---

# [approver/policy-calibration] Bot-authored fixer PRs abstain on author_trust yet merge unchanged after MEMBER approval

## Signal class
PRs authored by `nv-slang-bot[bot]` on `fix/issue-N` branches (small, CI-green, same-repo head, no protected paths) deterministically resolve to **ABSTAIN_POLICY / CLAUSE_FAIL:author_trust** under the bundled `v0-shadow` policy: the bot's `author_association` is CONTRIBUTOR, outside the trusted set `{OWNER, MEMBER, COLLABORATOR}`. This is a Step-1 clause FAIL → early return (no Devin/challenger/critique gate).

## Outcome observed (calibration)
shader-slang/slang#12870 ("Serialize empty language-server results as JSON null instead of {}") **merged unchanged at the exact commit the approver abstained on** (`d938204c5ecb`). MEMBER `jvepsalainen-nv` APPROVED at 13:20:53Z and merged minutes later; **zero follow-up commits** between the abstained commit and the merged head. An earlier revision (`7fb65358`) also abstained on the same clause. The diff grew 86/7 → 152/8 files across revisions but stayed within caps throughout.

## Transferable lesson
For this shape, the abstain is a **policy identity gate, not a code-quality signal** — and empirically these bot-fixer PRs are routinely human-approved and merged unchanged. Two implications:
- Don't spend challenger effort trying to "rescue" an approval on a bot-authored PR; the early-return on `author_trust` is correct and the human path resolves it fast. ABSTAIN rows are excluded from agreement scoring, so a later human APPROVE/merge is not a false-safe or disagreement.
- The recurring **merged-unchanged** outcome is the evidence for the standing operator question of whether to widen `trusted_associations` (or add a scoped bot-fixer trust) so this class stops abstaining. Treat repeated instances as calibration for that one standing escalation — NOT as per-PR infra defects and NOT as per-PR re-escalations of the empty policy mount.

## How Step-0 recall should use it
When a `nv-slang-bot[bot]` `fix/issue-N` PR of this shape arrives: expect ABSTAIN_POLICY:CLAUSE_FAIL:author_trust and a fast MEMBER merge. Record the row honestly and move on.
