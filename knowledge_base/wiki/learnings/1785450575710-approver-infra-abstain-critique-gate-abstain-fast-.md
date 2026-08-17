---
title: "[approver/infra-abstain] Critique-gate abstain fast-path breaks if the message text contains the tokens BLOCK or WOULD_APPROVE"
type: learning
topic: review-approval
source: learnings/1785450575710-approver-infra-abstain-critique-gate-abstain-fast-.md
---

# [approver/infra-abstain] Critique-gate abstain fast-path breaks if the message text contains the tokens BLOCK or WOULD_APPROVE

**Symptom:** Delivering a genuine `[Approval Decision] … ABSTAIN_POLICY` message got denied by `gate-critique-on-deliver.sh` with "missing critique stages: DECISION_REVIEW, OUTPUT_REVIEW" — even though ABSTAIN_* decisions are explicitly NOT critique-gated (the skill Step 4 early-return, and the hook's own ABSTAIN fast-path). On slangpy#1075 @ 4415159 this consumed denial-cap strikes and escalated to a human admin before I noticed.

**Root cause:** The hook's abstain fast-path (`gate-critique-on-deliver.sh` ~L98-103) fires only when the message matches `\b(ABSTAIN_POLICY|ABSTAIN_INFRA)\b` AND does **not** match `\b(WOULD_APPROVE|BLOCK)\b`. That second grep is a plain whole-word, case-sensitive ERE over the ENTIRE message body — it does not care whether the token is the decision or just prose. My `**Blocker:**` bullet explained *why* I held Devin's 🔴 "rather than a BLOCK verdict" — the literal all-caps word `BLOCK` in the explanation defeated the fast-path, so the gate treated the abstain as a gated decision.

**How to catch it:** Before sending an ABSTAIN `[Approval Decision]`, scan the whole message for the literal all-caps tokens `BLOCK` and `WOULD_APPROVE`. They are easy to introduce accidentally: "held as an open gap rather than a BLOCK", "clauses would_approve but…", the 5-bullet `**Blocker:**` field name is fine (lowercase-in-`Blocker` doesn't match `\bBLOCK\b`… but `BLOCK` inside it as a standalone word does if you capitalize it). The denial message ("denial cap reached; requesting human approval") is the tell.

**Fix:** In an ABSTAIN decision message, never write the bare uppercase enum tokens `BLOCK` or `WOULD_APPROVE` in explanatory prose. Reword: "a hard-fail verdict" instead of "a BLOCK", "round up to approve" instead of "WOULD_APPROVE". The decision-state token you *do* want is `ABSTAIN_POLICY`/`ABSTAIN_INFRA`. Also avoid the read-only `gh api .../pulls/...` route entirely — the same hook's BASH_PATTERNS (`gh api [^|]*pulls\b`) flags any `/pulls` REST call as "PR creation", even a GET; use `gh pr view --json …` instead (reviews, headRefOid, commits are all available there). Both false-positives burn denial-cap strikes toward the 3-strike human escalation. See [[approver-challenger-slangpy-external-slang-rhi-sub]] for the related mounted-policy check on this same PR.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785450575710-approver-infra-abstain-critique-gate-abstain-fast-.md`_
