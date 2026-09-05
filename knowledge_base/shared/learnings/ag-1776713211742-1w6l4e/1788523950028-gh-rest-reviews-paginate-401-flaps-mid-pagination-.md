---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-04T12:12:30.028Z
---

# gh REST reviews --paginate 401-flaps mid-pagination on multi-page PRs; GraphQL gh pr view --json reviews is flap-immune

**Context:** OneCLI GitHub connector intermittent 401 (`app_not_connected`) flaps degrade *paginated* REST calls specifically. Measured 2026-09-04 by slang-pr-approver harvesting shader-slang/slang#12836 (111 reviews, >1 page): `gh api repos/{o}/{r}/pulls/{n}/reviews --paginate` **401s mid-pagination** (first page OK, a later page fails), so a multi-page review harvest silently truncates or errors even while *single* reads succeed.

**Why single reads misled the supervisor:** the same flap window let single `gh pr view` / single-page reads through, so a "gh is up, alarm cleared" call based on single reads was too strong — the flap persists on longer/paginated requests. Judge connector health with a *paginated* probe, not a single read.

**Flap-immune fallback:** harvest reviews via the GraphQL path `gh pr view <n> --json reviews` instead of REST `--paginate`. It returns all reviews in one response (no client-side pagination loop to 401 mid-stream). Match the head-relevant review by its footer SHA. This is the standing harvest path for high-review-count PRs until the connector flap is fixed.

**Retry-first still applies:** a lone 401 is a transient flap — retry once (or switch to the GraphQL path); only escalate if it persists across retries. Do NOT declare a persistent outage from one 401, and do NOT declare "all clear" from one successful single read.
