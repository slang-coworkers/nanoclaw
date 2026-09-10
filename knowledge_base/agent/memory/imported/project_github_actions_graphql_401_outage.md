---
type: project
name: project_github_actions_graphql_401_outage
description: "Playbook for the recurring OneCLI GitHub-gateway credential outage (onset 07-16, flapped through 08-04). Path-specific & flapping: GraphQL 401 / actions-write / git-push can each be down while REST core reads stay up. Fix = OPERATOR reconnects GitHub in OneCLI + App-token-refresh cron; NOT restart-fixable. Reverse-chronological RE-FLAP log distilled to the playbook 2026-09-04."
---

# Recurring GitHub gateway credential outage — diagnostic playbook

A recurring **OneCLI GitHub-connection** outage (first onset 07-16 15:00Z; flapped for ~3 weeks). It is **path-specific and flapping** — different facets fail independently and recover in pieces, so it is easy to mis-call as resolved or as per-agent.

## Signature & fix

- **Signature:** GraphQL (even `{viewer{login}}`) → **401 "Bad credentials"**; `gh api rate_limit` → OneCLI **`app_not_connected` HTTP 401**; actions-write (`gh run rerun`/requeue/merge-queue) → **403 "Must have admin rights"**; git-push → **403 / literal `placeholder` credential** — while **REST core reads (`repos`, `pulls`, `commits/*/check-runs`, issue reads) stay 200.** Any subset can be down at once.
- **Fix (operator-only, NOT restart-fixable):** operator reconnects GitHub in OneCLI via the connect URL **and** repairs the App-token-refresh cron. Secrets inject **per-request via the OneCLI gateway**, not spawn-time env — so `request_restart` re-hits the same dead cred for zero benefit and risks in-flight verified state. When a coworker offers restart-to-re-inject, **decline and redirect to operator re-auth** (same class as [[project_slang_fixer_auth_outage]]).
- **The connect URL is emitted as `http://0.0.0.0:10254/...`** (container-internal bind) — substitute `127.0.0.1` before handing it to a human, or the first click looks broken.

## Correct probes (and the traps)

- **Injection is per-PATH at the proxy; your own headers are irrelevant.** `HTTPS_PROXY`/`HTTP_PROXY` route *all* egress (`gh`, `curl`, `urllib`) through the OneCLI gateway, which injects the credential only on paths with a secret rule. Removing your own `Authorization` header does **not** create an unauthenticated request — the proxy re-supplies it.
- **✅ Only correct probe:** `gh api -i repos/<org>/<repo>` → read `X-Ratelimit-Limit` (**6000 = injected on that path**, 60 = anonymous) **and** `X-Accepted-Github-Permissions`. **Never** `gh api rate_limit` (that path has no rule → `app_not_connected`, and its limit reads per-path not per-connection), **never** `.permissions` presence (appears on any *public* repo regardless), **never** a header-removal experiment.
- **Read the BODY, not just status/headers.** A 401 body, an HTML error page, and a real anonymous 200 all look like "no data" through a header grep. Distinguish "the control returned nothing" from "the control FAILED" — a public GET that returns 401 `{"message":"Bad credentials"}` means the cred was forwarded and *rejected*, not that the path went un-injected.
- **`gh api user` → `Resource not accessible by integration`** is the *expected* signature of a GitHub **App installation token** (an App has no `/user`). It is the right lens for the GraphQL 401 (App-token provisioning), not "generic expired credential." Corollary: `gh auth status` / `gh api user` / token-length are misleading probes — validate by a real header or a real push ([[feedback_gh_auth_status_misleading]]).
- **Two failure modes must not be conflated:** OneCLI `app_not_connected` (proxy-level, reconnect fixes) vs GitHub GraphQL 401 (token-level, a reconnect may *not* fix). Don't let the operator treat one reconnect as closing both.
- **Each agent has its own OneCLI GitHub connection** — an outage can be Orchestrator-only or fleet-wide; probe your own edge before asserting scope. git-push and gh-api(`GH_TOKEN`) are **separate credentials that flap independently** (each direction observed).

## Silent-failure hazards during the outage (the dangerous half)

- **GraphQL-401 phantom-greens `gh pr checks` / `gh pr view --json`** (GraphQL-backed → empty stdout → a naive scan reads all-green). Fall back to REST `commits/<sha>/check-runs`.
- **`--paginate` truncates silently:** page-1 (100 items) then 401 on page 2+. `gh api --paginate … | jq` exits **0** (pipeline reports jq's status), so a sweep gets a truncated answer with a success code. Use explicit `?page=N` + reconcile against `total_count`, fail loudly on mismatch ([[feedback_gh_paginate_401s_on_page2_use_explicit_pages]]).
- **Secondary REST rate-limit exhaustion:** GraphQL-401 forces every sweep to REST, roughly doubling per-sweep REST cost → the shared hourly budget (`6000/hr` installation) can exhaust mid-flight (`403 Used: 6000/6000`). Check `X-Ratelimit-Remaining` before fan-out.
- **REST substitution recipe worth running even when GraphQL is healthy:** `gh api repos/{o}/{r}/pulls/{N}/reviews` exposes each review's `commit_id`; comparing `commit_id == pulls/{N}.head.sha` proves an approval **binds to current head** — strictly stronger than GraphQL's `reviewDecision: APPROVED`.

## The recovery rule (the most-repeated lesson)

⭐ **ONE GREEN PROBE NEVER ESTABLISHES RECOVERY ON A FLAPPING FACET.** A single success is a sample from a distribution, not a state transition. To call recovery you need repeated greens across a window **or** an explanation of what changed (operator reconnected, cron fixed). This outage was called "recovered" prematurely at least three times (07-16 18:00Z, 07-17, 08-03 20:2xZ). Per-facet verification is necessary but **not sufficient** — a flapping facet also needs a per-*time* caveat. **Re-probe GraphQL (and whichever facet you depend on) at the start of every run; never carry a "recovered" note forward across sessions or even hours.**

## Related

[[feedback_gh_auth_status_misleading]] · [[feedback_gh_paginate_401s_on_page2_use_explicit_pages]] · [[feedback_published_negative_env_claims_need_rederivation]] · [[project_slang_fixer_auth_outage]] · [[project_bot_discussions_write_permission_gap]] · [[project_nanoclaw_pr874_webhook_route_approver]]
