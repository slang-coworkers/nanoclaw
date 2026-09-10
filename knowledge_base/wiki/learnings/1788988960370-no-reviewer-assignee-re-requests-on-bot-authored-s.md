---
title: "No reviewer/assignee re-requests on bot-authored Slang PRs (standing dev-team policy)"
type: learning
topic: review-process
source: learnings/1788988960370-no-reviewer-assignee-re-requests-on-bot-authored-s.md
---

# No reviewer/assignee re-requests on bot-authored Slang PRs (standing dev-team policy)

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786994139768-q7jtt3
written_at: 2026-09-09T21:22:40.370Z
---

# No reviewer/assignee re-requests on bot-authored Slang PRs (standing dev-team policy)

# Don't authorize formal reviewer re-requests on bot-authored Slang PRs

**Rule:** The shader-slang dev team has an **explicit standing policy forbidding requesting reviewers or assignees on bot-authored PRs** (`--add-reviewer` / `gh pr edit --add-reviewer` / `--add-assignee`), *including* pinging maintainers this way. Reason: it spams maintainer inboxes. This is on `slang-fixer`'s hard MUST-NOT list.

**Consequence for orchestration:** A relayed "operator authorized this re-request" does **NOT** override the standing policy — the fixer will (correctly) refuse, and refusing is the right call. If a human genuinely wants the formal API re-request despite the prohibition, the fixer requires that instruction from the **operator directly**, not relayed through the orchestrator/triager. Don't pressure the coworker to override its standing policy on a relayed authorization.

**What to do instead when a bot PR's review is stale:** post **one concise status comment on the PR that @-mentions the reviewer** ("CHANGES_REQUESTED nit addressed at <sha>, ready for re-review", with rationale + bot disclaimer). That notifies them via GitHub's native mention. It's sufficient re-engagement — and note that if the maintainer already left a CHANGES_REQUESTED review, **they are already the reviewer of record** (their review still stands; there's no pending-request slot to fill), so a formal re-request would be a no-op regardless.

**Measured 2026-09-09** on shader-slang/slang #12765 (the `+=`-on-legacy-`IArithmetic` fix, a spinoff of issue #12591's numerics work). I authorized "fixer re-requests review + posts a status comment"; the fixer posted the comment ([#12765 comment 5608909997](https://github.com/shader-slang/slang/pull/12765#issuecomment-5608909997)) but declined the formal `--add-reviewer` per the standing policy. Correct on both counts.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1788988960370-no-reviewer-assignee-re-requests-on-bot-authored-s.md`_
