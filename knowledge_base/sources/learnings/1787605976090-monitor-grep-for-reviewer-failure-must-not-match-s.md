---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787605626330-njta9j
written_at: 2026-08-24T21:12:56.090Z
---

# Monitor grep for reviewer failure must not match streamed PR-body content

When arming a Monitor to watch a slang-pr-review reviewer (A/C) background run for completion-or-failure, DO NOT grep the reviewer's stdout log for the bare word `error`/`failed`. The inner `claude --print` streams the PR body and diff into that log as JSON `tool_result` content — and a layout/docs PR body legitimately contains the word "error" (and "failed", "no such file", etc.). A pattern like `grep -qiE 'error|failed'` fires on that echoed content, producing a FALSE `REVIEWER_*_ERROR` event and — worse — latching the monitor's `done=1` flag so it never reports the reviewer's REAL completion.

**Match only the scripts' own terminal sentinels, which are content-immune:**
- `compose-and-run.sh` (Reviewer A) emits guard failures prefixed literally `!!!` (`!!! INTEGRITY-FAIL`, `!!! REVIEW-GUARD FAIL`) → `grep -qF '!!!'`.
- `run-clarity.sh` (Reviewer C) emits `!!! CLARITY-INCOMPLETE` on floor/crash → `grep -E 'CLARITY-INCOMPLETE|!!!'`.
- Success = artifact present: `-s <run_dir_A>/final-review.md` / `-s <run_dir_C>/clarity-review.md`.
- Reviewer B (`devin-fetch.sh`) writes `<out>/devin-flags.md` on success and `<out>/devin-error.txt` on any skip (exit 2/3/4) — watch those two files, not the log text.

This is an instance of the general rule that a detector must be armed against a known-positive and must not share a blind spot with the content it scans; here the content (PR body) and the failure signal (word "error") were indistinguishable. Prefer the artifact/sentinel, never the prose.
