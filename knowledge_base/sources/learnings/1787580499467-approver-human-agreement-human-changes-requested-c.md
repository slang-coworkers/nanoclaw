---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786605051479-olbflp
written_at: 2026-08-24T14:08:19.467Z
---

# [approver/human-agreement] Human CHANGES_REQUESTED confirmed a prior OPEN_GAP on the exact residual — a synchronize that only merges master doesn't move the decision

**Context:** slang#11387 (extend readNone carry gate to derivative variants). I decided ABSTAIN_POLICY:OPEN_GAP at head `2af3056b6301` on the reachable `[PreferRecompute]`+user-spellable-`__target_intrinsic` proxy that can suppress E41031 (author-documented, tracked in open #12502). A `synchronize` event later arrived flagging "new commits + `[draft]` dropped" as reasons to re-decide.

**Two transferable lessons:**

1. **A synchronize whose compare contains ZERO fix-file changes doesn't move the decision — but you must PROVE it with the compare API, not assume it.** The new head `4f9428a7059d` added only `"Merge branch 'master' into fix/issue-11374"`. `gh api repos/.../compare/<prior_head>...<new_head>` returned 300 files, ALL master churn (`.github/**`, `docs/generated/**`) — grepping the file list for the fix paths (`slang-ir-check-differentiability.cpp`, the tests) found NONE. The fix was byte-identical, so the prior (codex-confirmed) challenger analysis held verbatim; I still ran a fresh harvest+Devin+clauses (one row per revision commit) but the substance was unchanged. The orchestrator's "new commits pushed" was true yet non-substantive — **always diff prior-head→new-head via the compare API before assuming a synchronize changed the code; a master-merge synchronize is common and carries no fix delta.**

2. **A dropped `[draft]` label is NOT evidence of merge-readiness — read the live human review state at the head.** The tasking highlighted that the PR "no longer self-declares not-merge-ready." But a human MEMBER (`jvepsalainen-nv`) had posted CHANGES_REQUESTED at that exact head, blocking on the identical proxy gap and pointing to the same #12502 remedy. The label is author-controlled cosmetics; the review state is the real not-merge-ready signal. The draft-drop actually coincided with a STRONGER hold, not a weaker one. **When a self-declared-prototype signal is said to have been removed, check whether a human review superseded it — the removal of a soft self-label can hide a hard human block.**

**Calibration:** the human's CHANGES_REQUESTED AGREES with my prior OPEN_GAP on the same evidence (not the tautological "a human must look; a human looked" — a clean approval here would have refuted the abstain). Confirms the gate/flag + reachable-residual reasoning was correctly calibrated. Score: agreement.
