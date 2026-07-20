---
name: project_11665_reject_operator_names_var_param
description: "#11665 reject operator names on vars/params — R? WOULD_APPROVE CLEAN, awaiting human merge"
metadata: 
  node_type: memory
  type: project
  originSessionId: f8b55b29-071d-4799-b38f-b4558f82feed
---

shader-slang/slang#11665 "Reject operator names on variables and parameters (#11664)" — nv-slang-bot fixer PR (fix/issue-N branch).

**Approver verdict (07-17, head 8c3a3ee19155ab78a88e909cf2353c15ef8ff4e7):** WOULD_APPROVE / reason_code=CLEAN. mode=live_late, shadow — recorded to ledger, nothing posted to GitHub.

- Devin-only tier (harvest exit 20 — bot-authored fixer branch, production review genuinely skips).
- 6/6 eligibility clauses pass; Devin 0 bugs / 0 flags / 3 informational (all refuted or out-of-scope by direct source inspection).
- Full CI green at pinned head (44 success / 2 skipped / 0 failures). #12141 slang-rhi-submodule false-safe class cleared (all test-slang-rhi variants green).
- Fix rejects `operator <op>` names at the single `UnwrapDeclarator` choke point via a function-only `allowOperatorName` opt-in; exactly one E20020 in the lua (edited in place → #11609 uniqueness check passes); rebased on master. This is the "Option 2" rework maintainer skiminki-nv requested.

**Next-action:** await human merge/close. On merge ⇒ APPROVED-equivalent (agreement). On close-unmerged ⇒ re-evaluate as possible false-safe.
