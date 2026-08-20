---
type: project
title: "Why prod→lego forwarded issue OPENS but not issue COMMENTS — the mention gate runs before deliverGitHubMention's ROUTE_ISSUES_TO branch."
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# Why prod→lego forwarded issue OPENS but not issue COMMENTS — the mention gate runs before deliverGitHubMention's ROUTE_ISSUES_TO branch. Fixed in PR

The prod→lego webhook forward (`ROUTE_ISSUES_TO=lego`) forwarded issue **opens** but silently dropped issue **comments** until PR #525.

**Why:** PR #521 put the comment-forward branch *inside* `deliverGitHubMention` (`src/webhook-github.ts`, log string `dev-routed issue comment to peer`). But the **mention gate runs earlier**, in the HTTP handler (`src/github-webhook-server.ts`): `if (!isPeerForward && !body.includes('@nv-slang-bot')) return {skipped, reason:'bot not mentioned'}`. Human thread replies don't @-mention the bot → short-circuited before `deliverGitHubMention` was ever called. The drop is **silent** (writes a 200, no `log.*` line), so it's invisible unless you diff GitHub App hook deliveries against prod's forward log.

**Diagnosis trail (reusable):**
- GitHub App hook deliveries: `JWT` from `make_jwt()` in `~/.config/nanoclaw/gh-app-token.py` → `GET /app/hook/deliveries?per_page=N`; fetch each `/app/hook/deliveries/{id}` for the payload to classify `is_pr` (issue has `pull_request` key) and `human` (user.type != 'Bot').
- Lego orchestrator inbound: webhook-origin rows have `content LIKE '%"event":"github.%'`; **manual injections** have empty `source_session_id` + `trigger=1`. Session DB schema: `messages_in(content, timestamp, thread_id, source_session_id, ...)` — NOT `text`/`created_at`.
- prod forward log: `dev-routed issue to peer` (opens) vs `dev-routed issue comment to peer` (comments). If only the former appears, the gate is eating comments.

**Fix (PR #525):** compute `isPr`/`issueNumber` first, then exempt forward-bound non-PR issue comments: `willDevRouteToPeer = !isPr && ROUTE_ISSUES_TO && INSTANCE_SLUG && ROUTE_ISSUES_TO !== INSTANCE_SLUG`. Symmetric to the `issues` (open) path, which already skips the mention check ("bot is the audience, not the actor"). PR comments stay mention-gated — governed by `pr_session_mappings`, not `ROUTE_ISSUES_TO`.

**Test gotcha:** the handler isn't exported; test it by starting the real server (`startGitHubWebhookServer`, port 0) and POSTing a GitHub-signed body. Run via `npm test` (NOT bare `npx vitest`) — `npm test` sets `HTTP_PROXY= … NODE_USE_ENV_PROXY= NO_PROXY='*'`; without that the OneCLI MITM proxy intercepts the loopback request → "socket hang up". See [[feedback_no_external_post_ab_tests]] for the same proxy-on-localhost class of issue.

Related: [[project_lego_repo_webhook]], [[project_onecli_routing_model_dev]], [[reference_gh_app_token_mint]].

