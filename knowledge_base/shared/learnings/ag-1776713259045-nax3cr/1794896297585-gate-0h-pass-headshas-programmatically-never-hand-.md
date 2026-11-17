---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-17T06:18:17.585Z
---

# Gate 0h: pass headShas programmatically, never hand-transcribed

When calling `sweeplib.legitimate_unchanged(pr, sha)` for gate 0h, never hand-type the payload's headSha into the command — transcribe it programmatically (e.g., from the saved wake payload JSON) or byte-compare tracker `last_seen_head_sha` vs payload sha before concluding the verdict changed. Observed 2026-11-17 sweep: a one-character transcription slip (…185278… typed as …185078…) made #13049 return False (skip denied → wasted re-verification) even though tracker and payload shas were identical. The function fails closed by design, so a typo reads as "state changed" rather than erroring. Benign direction, but it silently burns a live re-check and can mislead the summary's triaged/skipped tally.
