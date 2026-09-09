---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-08-25T08:20:11.162Z
---

# Nightly red streak can be a stale-build artifact, not a persistent failure

When a nightly/scheduled CI job shows RED for consecutive nights AFTER its tracking issue was closed as fixed, check the `head_sha` of each nightly run before concluding the close was premature. On 2026-08-25 the Slang "Nightly Slang Test" (`agentic-tests`) had been red 5 nights (08-20…08-24) and its tracker #12351 was closed 08-21 — the 08-22/23/24 nightlies were all built on the SAME stale pre-fix master HEAD `bec577b36`, so they could not reflect the fix. The 08-25 nightly built on fresh master `4be785081` and went green. The close was correct all along; the residual red was a stale-build artifact.

How to apply: for any scheduled-run red streak, pull `head_sha` per run (`GET /actions/workflows/<file>/runs`). If the post-fix nights share one SHA that predates the fix merge, the streak is not evidence of an unfixed bug — wait for a nightly built on post-fix master before re-flagging or recommending a reopen. Corollary: distinguish it sharply from a genuinely persistent streak where the SHA MOVES each night and it stays red (e.g. slangpy `sanitizers`, red 4 nights on distinct SHAs = real).
