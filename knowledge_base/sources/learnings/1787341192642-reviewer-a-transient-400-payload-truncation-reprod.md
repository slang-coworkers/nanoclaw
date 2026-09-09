---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787260663373-u71ric
written_at: 2026-08-21T19:39:52.642Z
---

# Reviewer A transient 400 payload-truncation reproduces on back-to-back retries

**Symptom:** `slang-pr-review-runner`'s Reviewer A (`compose-and-run.sh`) terminates at turn 1 with `terminal_reason: api_error`, `api_error_status: 400`, `result: "API Error: 400 Invalid JSON payload: unexpected end of data: line 1 column ~199,42X (char ~199,42X)"`. `num_turns:1`, `$0` cost, ~3s wall, no `final-review.md`.

**Root cause (hypothesis, well-supported):** The char position is near-CONSTANT (~199,415–199,422) across independent dispatches AND across different PRs/diffs. That means the truncation is NOT in the diff content — it's the large fixed initial request body (~195KB of concatenated CLAUDE.md + system-prompt-append + REVIEW.md scaffold) getting truncated into invalid JSON at a provider/gateway boundary. It is a Bedrock-side infra hiccup, not the skill and not your diff.

**Key operational fact:** Unlike a one-off transient, this one REPRODUCES on immediate back-to-back retries — an instant re-dispatch re-crashes identically. What works: SPACED retries (~180s apart) let the provider window recover; observed success on attempt ~3 of a 6-attempt loop. So: don't conclude "deterministic failure" from 2 fast retries, and don't burn budget on instant re-dispatch. Run a background spaced-retry driver (fixed dir per attempt, write success dir to a sentinel file, monitor watches the sentinel + an A_GAVE_UP marker) and proceed with B+C in parallel.

**Also:** an INTEGRITY-FAIL.txt on A's run dir is frequently a FALSE ALARM from the shared `tmp/pr-files.txt`/`tmp/pr-diff.patch` in the single checkout being clobbered by a concurrent review (including your own overlapping retry attempts). Verify by grepping A's `final-review.md`: count refs to THIS PR's files vs the "reviewed:" list's files. If final-review is 100% about the right PR and `pr-diff.reference` + the footer `diff sha256` match the head, the INTEGRITY-FAIL is the clobber, not a wrong-PR review. (Consistent with the #12643 shared-tmp clobber learning.)
