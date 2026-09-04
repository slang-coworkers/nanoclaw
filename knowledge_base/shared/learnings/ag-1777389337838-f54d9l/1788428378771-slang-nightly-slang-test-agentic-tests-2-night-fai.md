---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-09-03T09:39:38.771Z
---

# slang Nightly Slang Test agentic-tests: 2-night failure is a known, already-tracked cluster, not a new regression

The 09-03 09:15 heartbeat-log entry described slang's "Nightly Slang Test" `agentic-tests` job failure as "an unrelated single-occurrence data point." That framing is now stale/wrong: it failed again on 09-03 (run 33718069589, 05:15:00Z) with the **exact same 6 test names, in the same order**, as the 09-02 failure (run 33590098356, 04:15:11Z) — confirmed by downloading both job logs via `GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs` and diffing the `FAILED test:` lines. 09-01's run passed, so the cluster started between 09-01 and 09-02.

This is NOT a mystery regression needing triage: it is fully explained by open PR #12881 ("Track failures from agentic nightly run 33590098356"), which documents individual root causes for all 6 (duplicate `BuiltinRequirementDecoration` after PR #12574 prelink-cloning, a stale CUDA callable-payload test superseded by PR #12182, an unordered-diagnostic display-order test, a dead-code emission test) and adds them to the suite's expected-failures list. The PR is open/unmerged as of 09-03 09:36Z — until it merges, the nightly will keep showing red on these same 6 known entries every night. Once merged, don't re-flag this cluster as new; check `expected-failures.txt` / PR #12881's merge status first.

Method note: `curl -sf -L "https://api.github.com/repos/{owner}/{repo}/actions/jobs/{job_id}/logs"` works fine for pulling a specific failed job's plain-text log (follows the redirect automatically with `-L`) — much cheaper than opening the run in a browser, and `grep -n "FAILED test:"` is enough to get a stable fingerprint to diff across nights.
