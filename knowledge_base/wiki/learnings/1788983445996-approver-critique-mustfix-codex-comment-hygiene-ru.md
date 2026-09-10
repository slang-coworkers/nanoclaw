---
title: "[approver/critique-mustfix] codex comment-hygiene rule misfires on the PR-under-review's author code during DECISION/OUTPUT review"
type: learning
topic: review-approval
source: learnings/1788983445996-approver-critique-mustfix-codex-comment-hygiene-ru.md
---

# [approver/critique-mustfix] codex comment-hygiene rule misfires on the PR-under-review's author code during DECISION/OUTPUT review

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788981843970-odwx3f
written_at: 2026-09-09T19:50:45.996Z
---

# [approver/critique-mustfix] codex comment-hygiene rule misfires on the PR-under-review's author code during DECISION/OUTPUT review

**Symptom.** On the approver's DECISION_REVIEW for slang#12968, codex returned **must-fix**: "`source/standard-modules/CMakeLists.txt:54` — the comment `# Build the experimental functional module` restates the following `add_subdirectory(functional)`; remove it before recording WOULD_APPROVE." Its own Notes simultaneously said the derivation was sound and "no evidence gap requires ABSTAIN_POLICY."

**Root cause.** The `/codex-critique` developer-instructions carry a "Comment hygiene (when a code diff is under review) … is must-fix" clause. That clause is written for CODE_REVIEW of *the agent's own* code edits. In the approver's DECISION_REVIEW / OUTPUT_REVIEW the artifacts include the **PR-under-review's diff** (as evidence), and codex applied the comment-hygiene rule to the PR **author's** source — flagging a nit the approver has no authority to fix (the approver is read-only against GitHub and never edits the PR). It was also a false positive on the merits: the flagged comment matched the file's own convention (every `add_subdirectory(X)` in that file is preceded by a `# Build the … module` comment — neural, numerics), so removing it would introduce inconsistency, not remove redundancy.

**How to catch it.** When a critique must-fix targets a line in the PR-under-review's diff (not in one of YOUR synthesized artifacts: clauses.json, review-doc.md, investigation.md, decision.md), recognize it as an out-of-scope misfire: DECISION/OUTPUT review governs the *decision derivation and deliverable*, not the author's code style. Author-side style nits map at most to an APPROVE_WITH_NITS-class advisory and never block the approver's decision.

**Fix / handling.** Do NOT abstain or attempt to "fix" author code. Reply on the same codex thread stating (1) the scope: DECISION/OUTPUT review covers the approver's derivation+deliverable, and this role never writes to GitHub; and (2) if applicable, that the flagged comment matches the file's established convention (cite the sibling `add_subdirectory` comments). Ask codex to re-verify on the corrected scope — it approved immediately. Net: ~1 extra round. Consider narrowing the approver's critique developer-instructions so the comment-hygiene clause is scoped to the agent's OWN edits, not evidence diffs.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1788983445996-approver-critique-mustfix-codex-comment-hygiene-ru.md`_
