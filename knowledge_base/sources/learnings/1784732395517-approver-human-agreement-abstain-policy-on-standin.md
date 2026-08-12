# [approver/human-agreement] ABSTAIN_POLICY on standing CR → human APPROVED = clean withhold resolution, NOT false-safe

# [approver/human-agreement] ABSTAIN_POLICY (standing CHANGES_REQUESTED) → human later APPROVED is a CLEAN agreement, not a miss

**PR:** shader-slang/slang#11136 @452d965a056c (R2). Shadow verdict ABSTAIN_POLICY:CHALLENGER_CONCERN. Human join = APPROVED (jhelferty-nv, review 4755728785 @2026-07-22T14:57:16Z on the exact decision head). Recorded via record_human_verdict.

## The pattern
Shadow verdict was ABSTAIN_POLICY because a human CHANGES_REQUESTED was standing/unresolved on the head; the code was actually correct (Devin clean, fix verified). Later the same maintainer issued a fresh APPROVED on the identical head. Naive scoring might read "approver abstained, human approved → approver was too conservative / disagreement." **That reading is wrong.**

## Why it's a clean agreement (not a false-safe, not a false-block)
- ABSTAIN_POLICY means "human must look" — it is NOT a "block" and NOT a prediction that the change is bad. It's the system correctly refusing to auto-approve over an unresolved human CR.
- The correct-behavior test for a withhold is directional: did shadow mode round UP over a live human changes-requested? It did NOT. It held. The human then looked and cleared their own CR. That is the withhold resolving exactly as designed.
- A false-safe is the opposite failure: WOULD_APPROVE where the human then required changes. This is the mirror-image GOOD outcome — the abstain gave the human room to act, and they did.
- Contrast: had I rounded up to WOULD_APPROVE while the CR stood, and the human then approved anyway, I'd have been "right by luck" but violated the never-round-up invariant. Being right for the right reason (abstain → human resolves) is the win.

## How to score / characterize
- Record human_verdict=APPROVED against the ABSTAIN_POLICY row. Characterize as AGREEMENT / clean withhold resolution, NOT a conservative miss. The approver's job on a standing CR is to defer to the human; the human acting (either direction) is the intended terminal state.
- Only treat an ABSTAIN→APPROVED as a calibration concern if the abstain rested on a fabricated/unverifiable gap (i.e., the "human must look" was manufactured, not a real standing CR). Here the CR was real and verified on the head, so no concern.

## Nuance verified (worth remembering)
The individual CHANGES_REQUESTED *review object* carried commit oid `890a600` (the pre-rebase commit), which is why a fixer framed the CR as "on old 890a600." But `reviewDecision` is an aggregate computed against the CURRENT head — it stood at CHANGES_REQUESTED on the rebased head `452d965a05` until the fresh APPROVED superseded it. So: a review row's `.commit_id` is the commit it was *submitted on*, NOT evidence the review is stale relative to the head. Always read `reviewDecision` (aggregate) + `latestReviews` for the in-force state, not the individual review's commit pin. Related: [[pr-11136-decided]].
