---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787052279959-u9xvw9
written_at: 2026-08-28T08:20:29.286Z
---

# [approver/critique-mustfix] The ABSTAIN fast-path records BEFORE the critique gate — don't take it until the review input is settled, or a late-surfacing BLOCK is locked out by the append-only ledger

**Symptom.** slang#12601 R3: I found a broken macOS install command via challenger, routed to ABSTAIN_POLICY/CHALLENGER_CONCERN, and took the skill's ABSTAIN fast-path — which records the ledger row IMMEDIATELY and skips the DECISION_REVIEW/OUTPUT_REVIEW critique gate. Minutes later, the OUTPUT_REVIEW (which I still ran because the delivery-marker gate fired on edit-count freshness) caught that a head-current CodeRabbit review had posted after my harvest and rated the SAME defect 🟠 Major/blocking — a review-found bug, which is BLOCK, not ABSTAIN. I tried to record BLOCK for the same commit → **refused**: the ledger is append-only / first-write-wins per commit_sha (host: "a decision for this commit is already recorded (ABSTAIN_POLICY)"). The row is stuck at the under-sharp verdict.

**Root cause.** The skill relaxes the critique gate for ABSTAIN_* because an abstain "asserts nothing about the code" — so the fast-path records with no second-tier review. That's sound WHEN the abstain is truly terminal. But it interacts badly with an incomplete review input: if your ABSTAIN rests on "no reviewer covered this" and that premise is actually a harvest race (a primary review is imminent/just-landed), the fast-path bakes in the weaker verdict before the stronger evidence can be incorporated. ABSTAIN and BLOCK are both non-approvals, so the operational outcome (don't merge) survives — but the ledger row's SEMANTICS (ABSTAIN = "human must look", excluded from agreement scoring; BLOCK = "verified defect") are lost, and calibration data is degraded.

**How to catch it.** Before taking the ABSTAIN fast-path, ask: is my review input actually settled? Specifically, if the abstain reason is "uncovered region / no reviewer signal / Devin-only," treat that as a cue to re-verify the harvest is complete (see sibling learning: harvest exit 10 on a fresh push is a pending-bot suspect). The fast-path's "record immediately, skip critique" is a convenience for genuine hand-to-human abstains, NOT a license to record before the evidence base stops moving.

**Fix.** For an ABSTAIN whose rationale is "no/incomplete reviewer signal," run the OUTPUT_REVIEW (or at least re-harvest) BEFORE calling record_decision — don't take the fast-path. A recorded ABSTAIN cannot be upgraded to BLOCK on the same commit. If you're already locked out (as here), keep the ABSTAIN row of record, correct the framing, and surface upward explicitly that the evidence warrants BLOCK so it isn't misread as mild — but the real fix is ordering: settle the input first.
