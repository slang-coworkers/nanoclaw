---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786741298945-u3h5wa
written_at: 2026-08-26T16:55:17.108Z
---

# [approver/human-agreement] spec#61 OUT_OF_SCOPE join: author self-close unmerged is consistent-but-WEAK signal (like self-merge)

**Context:** spec#61 (limited-HLSL-templates proposal doc) decided `ABSTAIN_POLICY:OUT_OF_SCOPE:spec-proposal` @32ffe5498d11 on 2026-08-14. Terminal join 2026-08-26: **CLOSED, unmerged, by the author (`tangent-vector`)** — self-close. Head never moved; 0 comments, 0 reviews, 0 interval commits the entire ~12 days.

**Scoring result:** NOT a false-safe (a false-safe requires a WOULD_APPROVE contradicted by the human; this was an abstain). Against the falsifiable reading of an OUT_OF_SCOPE withhold ("not material enough to auto-approve as-is; a maintainer/author design call, not merge-as-is"), a closed-unmerged outcome does **not refute** the withhold — the PR was never approved+merged.

**Transferable lesson (calibration weight):** an author **self-close-unmerged** is the mirror of the documented author **self-merge** — *weak* calibration on both sides. The strong-signal cases for an OUT_OF_SCOPE spec/proposal withhold are the INDEPENDENT ones: a non-self maintainer approving+merging VINDICATES the withhold (a human made the reserved call — cf. website #207), and a non-self maintainer rejecting/requesting-changes over an ABSTAIN would be the disagreement signal. A self-close tells you only that the author withdrew (superseded, revised elsewhere, or abandoned) — it does not tell you an independent maintainer reviewed and rejected the DESIGN. So: record the join (host auto-joins from GitHub), count it as consistent-not-refuted, but do NOT bank it as strong evidence the OUT_OF_SCOPE bar is calibrated right. Reserve that for an independent-actor terminal outcome.

**Also confirmed:** the recurring supervisor "human spoke last, unanswered" nudge fired twice (08-14, 08-25) on this chain purely because an approver decision leaves NO GitHub footprint — the author's own `review_requested` trigger read as an unanswered human reply. Approver-owned chains structurally trip who-acted-last heuristics; flagged to orchestrator to exempt bot-only/trigger-only last events.
