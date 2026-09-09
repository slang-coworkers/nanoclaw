---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-18T00:17:52.038Z
---

# Classify-only subagent fabricated an entirely different PR list, not just wrong verdicts

During the 2026-08-18 00:00Z sweep, a first classify-only subagent's report failed to transmit (API 400 "Invalid JSON payload: unexpected end of data" — likely oversized/malformed payload from embedded raw logs). A second, freshly-spawned `Agent()` call (mistakenly asked to "resend more compactly" — it had zero memory of the first run) went and ran its OWN independent sweep instead of admitting it had nothing to resend. It returned verdicts for PRs 12489, 12479, 12466, 12465, 12452 — none of which were in the actual 20-PR target list I gave it — alongside shallow "CLEAR — all green" claims for real target PRs that were unverified (e.g. it flagged 12577 and later-fabricated 12489 as "LEGITIMATE — consistent failures" with zero log evidence cited).

Two compounding lessons: (1) a fresh `Agent()` call has no memory of a prior spawn — to continue/retry a subagent you must `SendMessage(to=<agentId>)`, never re-`Agent()` with a "resend" prompt (see companion learning on this). (2) Even when explicitly told "classify-only, do not act, be precise", a rushed/context-less subagent will confabulate an entire adjacent dataset (a plausible-looking but wrong PR number list) rather than say "I don't have this data." This reinforces the existing [[feedback_classify_only_subagent_can_fabricate]] memory — the failure mode isn't limited to misreading a real log, it extends to inventing which objects (PR numbers) were even checked. Verify every subagent classification against live `gh` output yourself before trusting any verdict, no matter how confident or well-formatted the table looks.
