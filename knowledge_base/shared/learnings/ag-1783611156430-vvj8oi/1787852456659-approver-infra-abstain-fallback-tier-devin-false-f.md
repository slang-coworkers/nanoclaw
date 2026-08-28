---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787073715089-rgfdiu
written_at: 2026-08-27T17:40:56.659Z
---

# [approver/infra-abstain] Fallback-tier Devin false-🔴 forces ABSTAIN even when the finding is verifiably wrong — don't zero it, don't round it to BLOCK

## Symptom
PR #12600 r2 (shader-slang/slang @a925f6fa0da0): a synchronize re-review after my
r1 ABSTAIN/OPEN_GAP. The r1 gap (activating the markdown stage reddened
check-formatting) was genuinely fixed — check-formatting is GREEN on the new head,
REVIEW.md reformatted, human LGTM'd. Clean approve on the merits. But the source
was FALLBACK tier (no github-actions[bot] review; harvest exit 20), and Devin's
report carried a 🔴 "Bug: formatting check now fails for every PR" that was
factually FALSE (refuted by the green check-formatting run on the exact head).

## Root cause / trap
I investigated Devin's 🔴, proved it false, zeroed `bugs` in the synthesized
result, and recorded WOULD_APPROVE. DECISION_REVIEW (codex) correctly flagged this
must-fix: the fallback mapping (CLAUDE.md) is mechanical — "any Devin bug →
REQUEST_CHANGES" — and skill Step 3 explicitly forbids the challenger from
UPGRADING a doc's 🔴 toward approval. My investigation can only add caution, never
clear a 🔴 to approve.

## How to catch it
Two-sided rule for a fallback-tier doc that carries a Devin 🔴:
- You may NOT round UP to WOULD_APPROVE by zeroing the bug on your own
  investigation — that's the forbidden upgrade (the challenger is not a reviewer
  that can overrule the signal).
- You may NOT round DOWN to BLOCK unless you VERIFIED the 🔴 is real — BLOCK
  asserts a verified bug; recording it on a bug you've shown is false is a false
  positive that false-disagrees with the human.
- The truthful state is ABSTAIN_POLICY (reason CHALLENGER_CONCERN): "a human must
  look / confirm the false-alarm." Transcribe Devin's findings faithfully into the
  result (bugs:1), keep your merits refutation as commentary NOT applied to the
  counts, and abstain.

## Fix
Record ABSTAIN_POLICY / CHALLENGER_CONCERN. Faithful counts in the doc; merits
assessment noted separately. This is the conservative fallback procedure working
as intended, not an infra failure — Devin false-🔴s are exactly why the fallback
tier never auto-approves. The human-outcome join on merge scores whether the
abstain was warranted.
