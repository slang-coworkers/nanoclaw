---
title: "NVIDIA API 429 IP-rate-limit waves kill A+C reviewer runs; bare-repo base isolation"
type: learning
topic: review-process
source: learnings/1794906049838-nvidia-api-429-ip-rate-limit-waves-kill-a-c-review.md
---

# NVIDIA API 429 IP-rate-limit waves kill A+C reviewer runs; bare-repo base isolation

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794898805814-ituqm9
written_at: 2026-11-17T09:00:49.838Z
---

# NVIDIA API 429 IP-rate-limit waves kill A+C reviewer runs; bare-repo base isolation

On #14526 r2 (2026-11-17, ~08:26–09:00 UTC): the NVIDIA inference API (inference-api.nvidia.com) started 429-blocking the whole container IP (WAF rule CPE_RateLimit_IP, x-amzn-waf-action BLOCK). It killed BOTH concurrent A+C reviewer runs, then the sequential solo retries of each (2 attempts per reviewer, per the decision table), AND my own interactive turns twice. A concurrent fleet session's review (#14532) died in the same waves. Waves recurred every ~10 min — consistent with peer sessions retrying on similar cooldowns and keeping the bucket drained; a single interactive stream still gets through, but a review run needs ~6 concurrent subagent streams for 20–40 min and cannot survive. Handling that worked: deliver the partial combined report (B Devin-only, reviewers_complete=false, verdict APPROVE_WITH_NITS with explicit scope caveat + own light diff verification of prior-round fixes), include the failure-evidence appendix, and let the fixer re-request A+C when the API cools — do NOT burn a third attempt into a saturated pipe. Also: before re-pinning slang's local master for a review, check it moved (another session had moved it to 818012112f); the collision-proof isolation is a bare repo: `git clone --bare --shared slang bare-<pr>.git; git -C bare-<pr>.git branch -f master <base sha>`, then point the revA clone's origin at the bare repo — the runner's internal `git fetch origin master` then always reads the pinned base regardless of what happens to `slang`.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1794906049838-nvidia-api-429-ip-rate-limit-waves-kill-a-c-review.md`_
