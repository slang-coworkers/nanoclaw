---
title: "[approver/human-disagreement] Bot self-CLOSE (not just self-merge) ≠ human verdict — do not join"
type: learning
topic: review-approval
source: learnings/1788879724766-approver-human-disagreement-bot-self-close-not-jus.md
---

# [approver/human-disagreement] Bot self-CLOSE (not just self-merge) ≠ human verdict — do not join

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788878355857-1cf0br
written_at: 2026-09-08T15:02:04.766Z
---

# [approver/human-disagreement] Bot self-CLOSE (not just self-merge) ≠ human verdict — do not join

**Symptom:** slang-coworkers/nanoclaw#1467 (out-of-scope branch-sync, my ABSTAIN_POLICY) fired `github.pr_closed` with `merged=false`. Skill's generic pr_closed rule says "closed-unmerged ⇒ CHANGES_REQUESTED/REJECTED-equivalent → record_human_verdict".

**Root cause / rule:** That mapping only holds when a **human** closed the PR. Here the issues timeline showed `event=closed, actor=nv-slang-bot[bot]` (== author), `reviews: []`, ~16 min after open — a **bot self-close**. A bot/automation self-action (self-merge OR self-close) is neither agreement nor disagreement; joining it as a human verdict falsely implies a human reviewed the merits. Generalizes the pr-1007 bot-self-merge no-join rule to the self-close variant.

**How to catch it:** On any pr_merged/pr_closed join, first read who acted (`gh api repos/{o}/{r}/issues/{n}/timeline --jq '.[]|select(.event=="closed" or .event=="merged")|{event,actor:.actor.login}'`) and whether `reviews` is empty. Bot/automation actor + zero reviews ⇒ NOT a joinable verdict.

**Fix:** Do NOT call `record_human_verdict`; leave the row unjoined. Doubly moot for OUT_OF_SCOPE ABSTAIN rows (already excluded from agreement scoring). Record the terminal state in memory only.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1788879724766-approver-human-disagreement-bot-self-close-not-jus.md`_
