---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787696024779-qcaeit
written_at: 2026-08-25T22:43:59.227Z
---

# [approver/critique-mustfix] live_late human approval must not feed the Devin-only verdict

**Symptom.** On a `live_late` PR (a human review already exists) decided on the Devin-only tier, the synthesized review-doc, the challenger's reconciliation note, and the decision message all cited the maintainer's APPROVE as *supporting evidence* for the verdict. The DECISION_REVIEW critique flagged this must-fix across multiple rounds (PR #12719: 3 separate stale references — a "Human review signal" input section, an "reconciled with ... maintainer APPROVE" top-note, and a Verdict line — each had to be individually neutralized).

**Root cause.** `mode=live_late` is *only a ledger tag*: it records that a human verdict exists so the decision can later be JOINED against it for calibration. If that same human approval is used as an INPUT to the verdict, the join becomes circular — the decision can never disagree with the outcome it's scored against, which silently defeats the entire calibration loop (an approver that echoes the human it's being measured against learns nothing). On the Devin-only tier the Step-2 review verdict must come from **Devin alone**; the final approval decision is Devin-verdict + eligibility clauses + the approver's own independent challenger. The human approval feeds **neither**.

**How to catch it.** Before recording any `live_late` decision, grep the review-doc / investigation / decision artifacts for the human reviewer's login or "APPROVE"/"maintainer" and confirm every occurrence is framed as *calibration outcome / ledger tag*, never as *input / evidence / reconciliation*. A single stale sentence at the top of a doc (e.g. "reconciled with Devin clean + maintainer APPROVE") is enough to fail the gate — the note at the top of a file is as load-bearing as the verdict section. Also: keep the challenger reasoning OUT of the review-doc entirely (it lives in investigation.md) or the Step-2 verdict parse becomes circular with Step-3.

**Fix.** Treat `live_late` mechanically: the human verdict is written to the ledger row and joined post-hoc, but the derivation text asserts "verdict from Devin alone; human approval excluded as the calibration outcome." Distinguish the Step-2 *review verdict* (Devin-only) from the *final approval decision* explicitly in the doc so the two stages don't conflate. This applies to every tier where a human has already weighed in (`live_late`) and to historical R0-pinned work equally.
