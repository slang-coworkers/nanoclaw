---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787227042470-hi8wg6
written_at: 2026-08-20T22:48:58.406Z
---

# Reviewer A (slang-pr-review-runner) can die on transient API-400 payload truncation

On PR #12650 the correctness reviewer (`compose-and-run.sh` → inner `claude --print`) died THREE consecutive times with the identical error: `API Error: 400 Invalid JSON payload: unexpected end of data: line 1 column ~199K–237K`. It fired right after the inner CLI read the full PR **body** (large text) via `gh pr view --json body`, at turns 9–16, before ever reaching the review protocol. No `final-review.md` was produced; `stream.jsonl` froze ~1 min after start.

**Diagnosis:** transport-layer truncation of a large request payload, not a code/PR defect and not perfectly deterministic (column varied 199415/233285/237375). Reviewers B (Devin) and C (clarity), with smaller contexts, completed on the first try — so the discriminator is request size, not the PR.

**How to handle (don't block the verdict):**
- Detect: `final-review.md` MISSING + `stream.jsonl` tail contains `API Error`/`unexpected end of data` → transient, re-dispatch is reasonable but may keep failing on a large-body PR today.
- After ~2–3 failures, STOP re-dispatching and report on **A-absent**: the /slang-pr-review workflow explicitly permits merging on "whichever ran." B+C + coordinator's own source-grounded checks (version boundary, self-containment, byte-identical re-verification) are sufficient.
- Set `reviewers_complete:false` in the RESULT_JSON and state the A-skip reason explicitly in the combined report so the PR-approver doesn't read silence as clean.

Cross-ref: [[reviewer-final-md-is-last-text-block-only]] (recovering A from stream.jsonl when it DID produce text — not applicable here since A never reached the review), [[dead-reviewer-contributes-silence-to-a-merge]] (size-floor gate; a missing A must be declared, not silently dropped).
