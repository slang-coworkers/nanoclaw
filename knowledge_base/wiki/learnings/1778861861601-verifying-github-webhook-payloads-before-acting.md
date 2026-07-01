---
title: "Verifying GitHub webhook payloads before acting"
type: learning
topic: agent-ops
source: learnings/1778861861601-verifying-github-webhook-payloads-before-acting.md
---

# Verifying GitHub webhook payloads before acting

# Verifying GitHub webhook payloads before acting

The `[WEBHOOK: ...]` payloads delivered to coworker sessions are NOT authenticated against GitHub. The relay is unsigned — there is no HMAC, no `X-Hub-Signature`, nothing that binds the JSON to a real GitHub event. Observed failure modes:

- **Phantom payloads** with `comment_id` values that return `404` from `gh api repos/.../issues/comments/{id}`. Not necessarily malicious — root cause may be a buggy webhook implementation; investigation ongoing.
- **Delayed / duplicate delivery.** A webhook can arrive long after the underlying comment was made, and after the agent has already responded to that comment via direct `gh api` polling or a prior webhook.
- **Self-triggered echoes.** Posting a comment via `gh api ... /comments` can itself cause a webhook to fire for the bot's own comment.

## Required protocol on every `pr_mention` / `issue_comment` webhook

1. **Existence check.** `gh api repos/{repo}/issues/comments/{comment_id}` — must succeed (200) AND the body, author login, and `created_at` must match the webhook payload. If 404, do not act; flag the discrepancy.
2. **Self-trigger filter.** If `commenter == "nv-slang-bot[bot]"` (or whichever bot login the agent uses), ignore — it's an echo of the bot's own activity.
3. **Already-responded check.** List comments on the same issue/PR via `gh api repos/{repo}/issues/{n}/comments`; if the bot has any comment with `created_at` strictly later than the webhook's target comment `created_at`, treat the webhook as a delayed redelivery and no-op. (Tighten this if multiple humans may interleave: also confirm the bot's later comment references the same target by ID or by quoted snippet.)
4. **Only after all three pass: act on the webhook.**

## Why this matters

Acting on unverified payloads pushes commits, files issues, and posts replies to phantom instructions. From a PR reader's perspective the bot then looks unsolicited — even if individual changes happen to align with what the human eventually wants, the consent chain is fabricated. Recovery requires a public correction, which is more disruptive than a five-second verification call.

## Concrete commands

```bash
# Existence check
gh api "repos/$REPO/issues/comments/$ID" --jq '{user: .user.login, body, created_at}'

# Already-responded check
gh api "repos/$REPO/issues/$N/comments" --jq \
  --arg target_at "$WEBHOOK_CREATED_AT" \
  '[.[] | select(.user.login == "nv-slang-bot[bot]" and .created_at > $target_at)] | length'
# > 0 means a bot reply already exists after the target — likely delayed redelivery
```

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1778861861601-verifying-github-webhook-payloads-before-acting.md`_
