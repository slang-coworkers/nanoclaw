---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788481356485-mgy3e9
written_at: 2026-09-04T00:32:10.442Z
---

# [approver/policy-behavior] Bot-authored companion PRs abstain at author_trust before any review signal

## Symptom
slangpy#1135 (nv-slang-bot[bot]'s own companion PR for slang#12840, a clean 2-line
int→MatrixLayoutMode retype) resolved to ABSTAIN_POLICY:CLAUSE_FAIL:author_trust —
even though Devin ran clean (exit 0, no bugs/flags) and the synthesized review-doc
verdict was APPROVE.

## Root cause
The fixer bot (nv-slang-bot[bot]) opens companion/fix PRs; their GitHub
`author_association` is **CONTRIBUTOR**, which is NOT in the v0-shadow trusted set
`{OWNER, MEMBER, COLLABORATOR}`. eval-clauses.py's `author_trust` clause therefore
FAILS, and Step 1 short-circuits BEFORE the verdict parse and challenger. So for
this whole PR class the decision is a foregone author_trust abstain and the review
signal (Devin/CodeRabbit) never enters the decision.

## How to catch it
Cheap, decisive read available up front: `gh api repos/<owner>/<repo>/issues/<pr>
--jq .author_association` (the issues endpoint returns it and doesn't trip the
PR-creation critique hook that `gh api .../pulls/...` does). If it's CONTRIBUTOR/NONE
and the author is a bot, the decision is already an author_trust abstain regardless
of the review — the harvest+Devin build is moot work for the decision (still fine to
run for the audit trail, but it can't change the outcome).

## Fix / takeaway
- This abstain is WORKING AS INTENDED: shadow mode must not auto-approve a bot's own
  PR without a human. reason_code is POLICY (CLAUSE_FAIL), not infra — don't count it
  as a pipeline defect and don't try to drive it to zero.
- Separately: for slangpy companion PRs to a slang breaking change, the red build
  matrix (gcc-x86_64/msvc/macos) is the EXPECTED cross-repo circular-CI gate
  (slangpy ci.yml builds vs the pinned SGL_SLANG_VERSION that predates the new
  symbol), not a code fault. Note that eval-clauses.py's `ci_green_on_sha` reads the
  legacy combined-status endpoint (StatusContexts only, e.g. license/cla) — GitHub
  Actions CheckRuns are NOT aggregated there, so a red build matrix does NOT trip that
  clause; it showed `success` here.
- Possible workflow optimization (for maintainers, not a unilateral change): gate the
  expensive Devin browser run behind the cheap author_trust check when the PR author
  is a bot.
