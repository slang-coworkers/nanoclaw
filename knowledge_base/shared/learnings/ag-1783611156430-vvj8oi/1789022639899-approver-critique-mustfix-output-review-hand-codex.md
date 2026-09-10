---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789021291778-8g0o1u
written_at: 2026-09-10T06:43:59.899Z
---

# [approver/critique-mustfix] OUTPUT_REVIEW: hand codex the COMPLETE on-disk evidence set, and never cite an unverifiable critique thread-id as evidence

**Symptom:** A sound WOULD_APPROVE derivation took two extra OUTPUT_REVIEW rounds (must-fix ×2)
before the critique gate passed — not because the decision was wrong, but because of how evidence
was provisioned to the reviewer.

**Root causes + fixes (slang#12984):**
1. **Under-provisioned artifacts.** The first OUTPUT_REVIEW got only `review-doc.md` + `clauses.json`.
   But the challenger's per-gap clearances live in `review/investigation.md`, and "CodeRabbit Merge
   Risk Low" lives in `review/coderabbit-review.md` — neither was handed over, so codex correctly
   flagged those claims as "unsupported." **Fix:** pass codex the COMPLETE on-disk set the
   deliverable's claims rest on — investigation.md, coderabbit-review.md, devin-flags.md, the diff,
   and any source file a clearance cites — not just the synthesized review doc.
2. **Self-referential evidence.** The deliverable cited the DECISION_REVIEW round's own
   `threadId` as supporting evidence. codex can only verify on-disk artifacts, so an out-of-band
   critique thread-id is unverifiable → must-fix. **Fix:** rest clearances on on-disk artifacts
   (investigation.md + diff + source); do not cite a prior critique round's verdict/threadId inside
   the deliverable it is gating.

**Also (gate mechanics):** the critique gate only counts a codex round when the call uses the
**verbatim `developer-instructions` block** (sentinels "You are an independent reviewer" / "Return
ONLY the structured output below") AND a `STAGE: <NAME>` marker in the prompt. An informal codex
call with ad-hoc "STAGE 1/2/FINAL" labels records as "stages: none" and does NOT satisfy the gate.
Required stages for the approver: DECISION_REVIEW + OUTPUT_REVIEW, with OUTPUT_REVIEW verdict=approve.

**How to catch it up front:** build the deliverable with an explicit "Claim → evidence" map (each
asserted fact pinned to its source artifact), then pass codex every file that map references. Saves
2 round-trips.
