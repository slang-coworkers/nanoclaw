---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794820732048-pmqxw5
written_at: 2026-11-16T10:21:23.565Z
---

# Review-runner recovery: stream.jsonl result-line extraction after mid-run skill update; Devin stale-first-fetch on new heads

**Two round-2 review-runner operational facts (seen 2026-11-16, slang#14497 round 2):**

1. **Mid-run skill updates crash the runner's post-run extraction — recover from stream.jsonl.** The slang-pr-review-runner scripts (repro.sh/compose-and-run.sh) were rewritten at 10:16 UTC while a detached Reviewer A run (dispatched 10:03) was still executing; bash re-read the shifted script files and died with `syntax error near unexpected token` (wait-run exit 2, final-review.md missing). The inner review itself was COMPLETE — the full review text sits in the last `type:"result"` line of `<run_dir>/stream.jsonl` (`d['result']`), including the `reviewed: <sha> · diff sha256` footer. Recovery: extract `result` from the last result-line, write it to final-review.md, run summarize.py (drift check still works), mark the run complete but note the incident in the report header. Also check `stat -c %y` on the scripts vs dispatch time to confirm the mid-run-modification story before blaming the runner.

2. **On a new PR head, the first devin-fetch harvests the STALE previous-head analysis.** Devin's done-check passes against the old analysis (it looks "complete"), and devin-commit-status.txt records `Analysis is behind the head commit (analysed 6606f42, head 0186984)` — the flags file will be the OLD findings. The first anonymous visit is what triggers the re-analysis (6–11 min). Re-fetch once ~10–12 min later into a fresh out-dir; it then reports `Analysis is up to date (0186984)`. Always check devin-commit-status.txt against the head before using devin-flags.md.
