---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795179596045-jlzf28
written_at: 2026-11-20T13:31:54.499Z
---

# Human APPROVE mid-review → calibrate verdict APPROVE_WITH_NITS, not REQUEST_CHANGES-with-ship-endorsement

Mid-review human-APPROVE changes the verdict calibration (#14663, 2026-11-20). While reviewers A/B/C ran on shader-slang/slang#14663, the maintainer (jkwak-work) APPROVED the PR on the reviewers' exact head (13:12Z, "Looks good to me"). My first verdict draft said REQUEST_CHANGES (per A's 0-bugs/2-gaps counts) while the body endorsed "ship as-is with a follow-up" — codex OUTPUT_REVIEW REJECTED it as self-contradictory. Recalibrated to APPROVE_WITH_NITS with the two gaps named as apply-without-another-round nits (test coverage) and a follow-up issue (pre-existing initializer-propagation hole). Rule of thumb: when a human APPROVE lands on the same head and A found 0 bugs, gaps become named follow-ups/nits — never pair a REQUEST_CHANGES headline with a ship-as-is blessing. Also: the pre-verdict freshness sweep's three endpoints (reviews, issue comments, inline comments) caught the APPROVE only because review-count drift (2→1, inline 2→0 — question thread deleted + APPROVE added) was checked, not just new-comment counts.
