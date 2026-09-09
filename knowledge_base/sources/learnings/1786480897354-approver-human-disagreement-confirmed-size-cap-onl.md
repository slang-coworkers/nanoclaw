---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786478380681-fex0ho
written_at: 2026-08-11T20:41:37.354Z
---

# [approver/human-disagreement] confirmed: size-cap-only abstain on a trusted-author, clean-signal PR reliably ends in merge (slangpy#1101)

**Signal:** slangpy#1101 (Logger deadlock fix, follow-up to #1081) was decided ABSTAIN_POLICY twice — R1 (403 lines) and R2 (420 lines) — both solely on `CLAUSE_FAIL:tier_eligible`. Human outcome: **merged** at f35e6159dc7e, which is my exact R2 decision commit (merge commit d358908111). Merged ⇒ APPROVED-equivalent. ABSTAIN_POLICY rows are excluded from agreement scoring, so this is neither a false-safe nor a scored disagreement — it is a calibration confirmation.

**What the shape was:** trusted author (MEMBER), same-repo head, no protected paths, review signal clean (Devin 0 bugs/0 flags on the final head; CodeRabbit only 2 self-labeled non-blocking nits, one of which — the `debug_once` coverage — the author actually added in the R2 commit), and the ONLY failing predicate was the mechanical size cap (a few % over 400). It self-merged with all CI eventually green and no formal human review (reviewDecision stayed REVIEW_REQUIRED; author merged directly).

**Transferable lesson for Step-0 recall:** A PR whose *only* abstain reason is `tier_eligible` (or another size/scope clause), with an otherwise-clean signal and a trusted author, is the canonical "abstain = routing, not concern" case. Do NOT let the size cap tempt a challenger into manufacturing a code concern to justify the abstain — the code was fine here. The abstain did its job (route to human) and the human shipped it unchanged. Report these with the size reason named plainly so the human isn't misled. This is the *expected* healthy behavior of the size gate, and future reviews of similar deadlock/concurrency follow-ups in sgl/core should expect the same: abstain on size, merge unchanged.

**Secondary observation (not decision-affecting here):** at R2 the `ci_green_on_sha` clause read combined-status = `success` (CodeRabbit's status) while the GitHub Actions BUILD check-runs were still in-progress. Those builds DID all go green by merge, so the blind spot caused no wrong outcome this time — but the clause measures the legacy commit-status API, not the Actions check-runs. On a PR where builds later fail, this clause could pass `ci_green_on_sha` off a non-build status. Worth a policy note if false-approves ever trace to it. (See prior: [approver/infra-abstain] critique-gate false-fire on gh api pulls reads.)
