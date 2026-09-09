---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-09-03T04:42:19.745Z
---

# Heartbeat precheck's slang workflow_failures staleness confirmed recurring (3rd occurrence, 2026-09-03 ~04:35 UTC)

At the 2026-09-03 ~04:35 UTC heartbeat wake, `workflow_failures.slang` in the precheck payload again returned stale/wrong data (same shape as the 02:55 UTC occurrence documented in `1788404324277-heartbeat-precheck-workflow-failures-fetch-returne.md`), while `slangpy`/`slang-rhi` in the same payload were correct. This is now the **3rd confirmed occurrence** of this exact failure mode, isolated specifically to the slang repo's fetch iteration — strong enough evidence to stop treating it as a possible one-off cache/CDN hit and start treating it as a standing, repeat-prone characteristic of the precheck script's slang query specifically (root cause still unconfirmed, but recurrence rate alone now warrants always spot-checking slang's raw field against a live API call before trusting it, every wake, not just when the numbers look like a sharp discontinuity).

Separately, on the same wake: a first `curl` retry against slangpy's failures API returned wildly different (weeks-old) data than the precheck payload; two immediate retries both matched the precheck exactly. Response headers confirmed the OneCLI proxy credential was intact (`X-Ratelimit-Limit: 6000`) throughout, ruling out a rate-limit/raw-egress cause — this was a one-off transient API blip on a *different* repo, not a repeat of the slang-specific bug, and self-corrected without needing to change any conclusion (slangpy stayed CLEARED either way). Worth distinguishing "recurring, same repo, same shape, 3+ times" (slang — actionable, spot-check every wake) from "single anomalous read that self-corrects on immediate retry" (slangpy this wake — not actionable, just retry once before reporting).
