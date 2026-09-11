---
title: "[approver/human-disagreement] Confirmed: protected-path ABSTAIN merged UNCHANGED — code was fine, and 🟡/🔵 non-blocking notes did not gate merge"
type: learning
topic: review-approval
source: learnings/1789072127139-approver-human-disagreement-confirmed-protected-pa.md
---

# [approver/human-disagreement] Confirmed: protected-path ABSTAIN merged UNCHANGED — code was fine, and 🟡/🔵 non-blocking notes did not gate merge

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789021443349-lncfi9
written_at: 2026-09-10T20:28:47.139Z
---

# [approver/human-disagreement] Confirmed: protected-path ABSTAIN merged UNCHANGED — code was fine, and 🟡/🔵 non-blocking notes did not gate merge

**Outcome join (calibration):** slang#12986 merged (by jkwak-work) at head_sha `0c8fbd357f0ae3d835f359ef37a8a4b2788a1c83` — the EXACT commit the approver recorded ABSTAIN_POLICY (CLAUSE_FAIL:no_protected_paths) on in rev 2. merged ⇒ APPROVED-equivalent human verdict; the host auto-joins it onto the decision row. No `record_human_verdict` tool is exposed to the approver — the join is host-side (see the record_decision tool contract: "human review outcome is joined automatically by the host").

**What shipped vs. what I read:** ZERO follow-up commits between my decision commit and the merged head — the PR merged exactly as I saw it. This confirms two priors with real outcome data, not just approval:
1. The protected-path ABSTAIN was safe: the code shipped unchanged and merged cleanly. A protected-path abstain that later merges unchanged is the steady state for PRs that legitimately edit `.github/workflows/**` alongside code (here: SLANGPY_CHERRY_PICK_PR coordination). Excluded from agreement scoring, so no false-safe — and the merge proves it was genuinely fine.
2. The head-current production review's two 🟡/🔵 non-blocking notes — 🔵 "make the 'all IRSpecialize Unknown-args are matrix-layout' invariant explicit / add a pinning test" and 🟡 "relabel pr: breaking change (let L:int no longer compiles)" — were NOT addressed by any pre-merge commit, yet maintainers merged. Confirms these were correctly non-blocking.

**Transferable rule for the challenger's gap-severity step:** review notes of the shape "document/pin this invariant" and "PR-label hygiene (breaking-change relabel)" do NOT gate merge on this class of change — resist escalating them to OPEN_GAP/ABSTAIN absent a concrete real-world trigger; they are advisory. Reserve OPEN_GAP for a plausible real trigger with blast radius, per the conservative-lean bar. (The invariant-pinning 🔵 is exactly the gate/flag-PR probe area — but note it was a QUESTION on a widening-shaped rewrite the reviewers had already traced as memory-safe, not a demonstrated dead-flag/always-skip.)

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1789072127139-approver-human-disagreement-confirmed-protected-pa.md`_
