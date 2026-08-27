---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787791581873-1nos8b
written_at: 2026-08-27T00:57:53.535Z
---

# [approver/challenger] bot-authored PR: builds cancelled + tests skipped = head never build-verified

**Symptom.** slang#12674 (bot-authored `fix/issue-12668`, parser+checker change, 402 add/20 del). Devin exit 0 no bugs; Step-1 clause `ci_green_on_sha` PASSED (vacuously — "policy does not require CI green"). Looks approvable on the surface.

**Root cause / what the artifacts actually said.** On the pinned head:
- combined commit status = **failure**; `check-ci` check-run = **failure**;
- **every `build-*` job = `cancelled`** ⇒ the compiler was never successfully built;
- **every `test-*` job = `skipped`** ⇒ `slang-test` (and the PR's OWN new diagnostic tests) never ran;
- a `CI` run sat `status:waiting` (workflow_dispatch) behind `wait-for-human-priority` / `falcor-build-approval-gate` — on bot-authored PRs the real build is gated behind pending human approval and had not been allowed to run.
The PR body openly admitted it: "This HEAD has not been compiled locally and slang-test has not been run." Devin's "clean" was non-independent — its "AI Analysis" was a paraphrase of the PR body, not a code audit. Human `jkwak-work` = COMMENTED (not APPROVE): "will discuss with Yong or Tess before approving."

**How to catch it.** For a code change (esp. parser/checker/IR), do NOT trust `ci_green_on_sha=pass` — the v0 policy makes it vacuous. Independently enumerate `actions/runs?head_sha=<head>` and `commits/<head>/check-runs`: if `build-*` are cancelled/absent and `test-*` are skipped, the head was NEVER compiled or tested regardless of any green ancillary checks (PR Maintenance, Verify Labels, Formatting, REUSE, SlangPy-trigger compile nothing). A bot-authored PR often has its build parked behind a human-approval gate (`wait-for-human-priority`) — so "CI hasn't run" here is the normal state, not a red flag to route around. Cross-check the PR body for a "not compiled / CI is the verification path" admission.

**Fix (decision).** This is neither BLOCK (no *verified* 🔴 bug — only the absence of verification) nor WOULD_APPROVE (skill Step 3: "inability to complete the check ⇒ ABSTAIN"). Record ABSTAIN_POLICY / **CHALLENGER_CONCERN** (policy family, not infra — the pipeline worked; the abstain is about the PR's unverified state + pending human build gate). A human must let CI build+test the head and settle the deferred review before merge.

**Gate mechanic caught in passing.** The delivery hook's ABSTAIN fast-path (`gate-critique-on-deliver.sh:98-103`) opens only if the message matches `ABSTAIN_POLICY` **and NOT** `\b(WOULD_APPROVE|BLOCK)\b`. Writing "Not BLOCK… not WOULD_APPROVE…" in the `[Approval Decision]` body defeats the fast-path and forces the full critique gate. Phrase the abstain message WITHOUT the literal tokens WOULD_APPROVE/BLOCK.
