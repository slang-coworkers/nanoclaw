# Cross-Instance Webhook Routing

How GitHub webhooks reach the right NanoClaw instance and the right session inside it.

## TL;DR

```
                     GitHub
                        │
                        │   issue_comment, pull_request_review_comment, issues
                        ▼
                 prod:3841   ◄── canonical webhook router (single entry point)
                        │
                        │   HMAC ✓ → mention check → mapping lookup
                        │
                ┌───────┼─────────┬─────────────────┐
                │       │         │                 │
        owner=prod   owner=lego  no mapping     ROUTE_ISSUES_TO=lego
        local        forward     orchestrator   forward
        delivery     (peer-      dispatch       (dev-route flag,
                     signed)                     issues only)
                        │                              │
                        ▼                              ▼
                 lego:3843     ◄── peer instance, accepts forwards
                        │
                        ▼
                 mapped session inbox (or lego orchestrator
                 if peer-forward arrives without local mapping)
```

Every webhook lands at exactly one canonical entry. Routing decisions are deterministic from `pr_session_mappings.owner_instance` plus a few env vars. No broadcast fanout, no race conditions, no duplicated handlers.

## Glossary

- **Canonical instance** — the install that owns the `pr_session_mappings` table and is the sole receiver of GitHub App webhooks. Today: `prod`. Identified by `INSTANCE_SLUG=prod` and `PR_MAPPINGS_LOCAL=1`.
- **Peer instance / leaf** — a non-canonical install (e.g. a dev install). Doesn't receive GitHub webhooks directly; receives forwarded webhooks from the canonical router. Today: `lego`. Identified by `INSTANCE_SLUG=lego` and (typically) `PR_MAPPINGS_LOCAL=1` for cache lookups.
- **Mapping** — a row in `pr_session_mappings` of the form `(repo, pr_number) → (owner_instance, agent_group_id, session_id, thread_id)`. Says which session on which instance owns a given PR.
- **Marker** — a structured token in the orchestrator's coworker-dispatch text that authorizes the receiving coworker to post back to GitHub. Today: `<github-post-authorized />` plus `REPO=`, `PR=`, `COMMENT_ID=`, `COMMENTER=` lines. It lives in the orchestrator's skill text; the host does not parse it, so it is not a host-side grant and cannot be used to authorize a PR claim.

## Routing decision tree

When a webhook hits the canonical router, here's what happens in order:

1. **Trust & filter** (`src/github-webhook-server.ts`)
   - Verify `X-Hub-Signature-256` HMAC against `GITHUB_WEBHOOK_SECRET`. (Or `X-Internal-Signature-256` if `X-Webhook-Trust: pre-validated` — that's a peer forward, see below.)
   - Filter event type (only `issue_comment`, `pull_request_review_comment`, `issues`).
   - For comments: filter for `@nv-slang-bot` mention in body. (Skipped on peer-forward — already filtered upstream.)
   - For issues: action must be `opened`. (No mention check; new issues can't tag the bot.)

2. **Mapping lookup** (`src/webhook-github.ts`, `deliverGitHubMention`)
   - Query `pr_session_mappings WHERE repo=? AND pr_number=?`.
   - **Miss + canonical** → fall through to step 4 (orchestrator dispatch).
   - **Miss + non-canonical (peer-forward)** → orchestrator dispatch, this instance's local one.
   - **Hit + `owner_instance == INSTANCE_SLUG`** → step 3a (local delivery).
   - **Hit + foreign owner** → step 3b (forward to peer).

3a. **Local delivery**
   - Open the mapped session's `inbound.db`, `insertMessage(kind=webhook, content=github.pr_mention | github.issue_opened)`.
   - Host posts 👀 reaction (deterministic; doesn't depend on the agent waking up).
   - Sweep loop wakes the container within ~60s, agent processes the webhook.

3b. **Foreign-owner forward**
   - Look up `INSTANCE_FORWARD_TARGETS[owner]` for the peer URL.
   - Sign the raw GitHub body with `INTERNAL_REGISTER_SECRET` via `X-Internal-Signature-256`.
   - POST to the peer with `X-Webhook-Trust: pre-validated` so the peer skips its filters.
   - Fire-and-forget; on peer error, the next webhook on the same PR retries.
   - Host does NOT post 👀 — the peer's coworker handles it on receipt.

4. **Orchestrator dispatch (no mapping)**
   - Deliver to the admin agent group's active session. The orchestrator coworker reads the event and decides which coworker should handle it via its CLAUDE.md instructions (typically project-aware: nanoclaw repo → nanoclaw-reviewer, slang repo → slang-reviewer, etc.).
   - The orchestrator's `slang-github-webhook` skill emits the `<github-post-authorized />` marker in its dispatch text whenever the trigger was a `@nv-slang-bot` mention. The receiving coworker uses that marker to decide whether to post the result back to GitHub.

5. **Issues special case (dev-routing)**
   - If `ROUTE_ISSUES_TO=<peer-slug>` is set on the canonical router, every `issues` action=opened event forwards to that peer instead of going to the local orchestrator. Used today as `ROUTE_ISSUES_TO=lego` so triage development happens on the dev instance.

## Per-instance configuration

### Canonical (prod) `.env`

```
GITHUB_WEBHOOK_SECRET=<App webhook secret>
GITHUB_WEBHOOK_PORT=3841

INSTANCE_SLUG=prod
INTERNAL_REGISTER_SECRET=<shared with peers, distinct from webhook secret>

# Forward foreign-owned PR comments here. slug=URL, comma-separated for multiple peers.
INSTANCE_FORWARD_TARGETS=lego=http://127.0.0.1:3843/webhook/github

# Optional: dev-route every newly-opened issue to a specific peer for triage testing.
# Comments on PRs are unaffected.
ROUTE_ISSUES_TO=lego
```

### Peer (lego) `.env`

```
GITHUB_WEBHOOK_SECRET=<peer's webhook secret, distinct>
GITHUB_WEBHOOK_PORT=3843

INSTANCE_SLUG=lego
PR_MAPPINGS_LOCAL=1                                # write to local cache too
INTERNAL_REGISTER_URL=http://127.0.0.1:3841/internal/register-pr
INTERNAL_REGISTER_SECRET=<same as prod>            # symmetric trust channel

# INSTANCE_FORWARD_TARGETS NOT SET on peers — leaves don't fan out further.
```

## Two trust channels, one secret

`INTERNAL_REGISTER_SECRET` is shared between prod and every peer. It signs:

- **Outbound from peer** → `POST /internal/register-pr` (write a mapping into the canonical store).
- **Outbound from canonical** → `POST /webhook/github` with `X-Webhook-Trust: pre-validated` (forward a webhook to a peer).

Both sides verify with the same secret. The endpoint distinguishes the two flows by URL path (`/internal/register-pr` vs `/webhook/github`).

`GITHUB_WEBHOOK_SECRET` is **not** used for peer traffic — only for GitHub's own deliveries. A leak of the GitHub webhook secret can't be used to write mappings or forge peer-forwards (they don't share the secret).

## What happens to the table

Writes are **first-claim-wins**, not last-writer-wins. Both writers take
`repo`/`pr_number` from an agent-composed message, so an unconditional upsert
let any agent group capture any PR's webhook traffic. A claim binds on first
write; the holding group may refresh its own row (its session id changes on
every container restart); anyone else is refused, loudly. Deliberate
reassignment goes through `ncl pr-mappings remap`. Details and the reasoning:
`src/modules/pr-mapping/store.ts`.

| Action | Canonical (prod) | Peer (lego) |
|---|---|---|
| Local agent calls `report_pr_created()` (this instance owns the PR) | claim locally; no remote call | local claim (cache); POST to canonical `/internal/register-pr` |
| Peer agent's `report_pr_created()` arrives at `/internal/register-pr` | claim in local table with `owner_instance=<peer-slug>`; **409** if another claimant holds it | n/a (peer doesn't host this endpoint with write semantics) |
| Webhook delivery, lookup hit local owner | Read row, deliver locally | Read cache row, deliver locally |
| Webhook delivery, lookup hit foreign owner | Forward to peer | Should not happen on a peer (canonical did the lookup) |
| Webhook delivery, lookup miss | Orchestrator dispatch (local) | Orchestrator dispatch (local) — usually means the canonical router didn't have the mapping either |

The peer's local table is a **read-side cache**, kept consistent because `report_pr_created` is the only writer (no out-of-band mutations). It's not authoritative; if it falls out of sync, prod's table is the truth.

## Round-2 hygiene

When a coworker re-reviews the same PR (e.g. the human re-tags `@nv-slang-bot review` after a force-push), the workflow is responsible for collapsing prior bot output before posting a new review:

1. `cleanup.sh` (in `slang-pr-review-runner` skill) — minimizes prior bot review bodies as `OUTDATED`, resolves prior bot review threads, minimizes prior tracking comments. Targets the bot identity only (`nv-slang-bot`).
2. `post-review.sh` — POSTs the new review with `event=COMMENT` (never `APPROVE`/`CHANGES_REQUESTED`), then runs a safety-net pass that dismisses any non-COMMENT bot reviews accidentally submitted.
3. `post-back.sh` — wraps the two for the workflow's Step 6 entry point.

This mirrors the production `claude-pr-review.yml` workflow's "Clean up previous Claude reviews" + "Dismiss unauthorized bot approvals" pattern. The user always sees one current bot review with prior reviews collapsed.

## When the bot is allowed to post

Only when authorized. The contract:

- Webhook arrives → orchestrator looks at the comment body.
- If body contains `@nv-slang-bot` → emit `<github-post-authorized />` marker in the dispatch to the chosen coworker.
- If no `@nv-slang-bot` (e.g. internal scheduled task, chat invocation, peer handoff) → no marker.
- Coworker's workflow checks for the marker. Present → run `post-back.sh`. Absent → return result via `send_file` only.

This guarantees the bot only writes to GitHub when a human explicitly invited it.

## Token scope reality

| Repo path | Token | `pull_requests:write` |
|---|---|---|
| `shader-slang/*` | App install 122982130 (shader-slang org) | ✅ granted |
| `slang-coworkers/*` | App install 123550981 (slang-coworkers org) | ❌ default `metadata:read` only |
| `szihs/*` | App install 122269597 (szihs personal) | varies |

`post-review.sh` returns exit 3 on HTTP 403. The wrapping workflow falls back to `send_file` only — the human still has the review via the parent thread. Don't take 403 as a hard failure.

If you want the bot to post on `slang-coworkers/*`, add `pull_requests:write` (and `issues:write` for the 👀 reaction) to install 123550981 via the App's installation settings page.

## Operational playbook

### Adding a new peer instance

1. Pick a slug. Add to `VALID_INSTANCE_SLUGS` in `src/config.ts` (one-line code change), open a PR.
2. On prod: append `<slug>=<peer-webhook-url>` to `INSTANCE_FORWARD_TARGETS`.
3. On the new peer: set `INSTANCE_SLUG=<slug>`, `INTERNAL_REGISTER_URL=http://prod-host:3841/internal/register-pr`, `INTERNAL_REGISTER_SECRET=<shared>`.
4. Restart both. Verify with: open a PR from a peer agent, watch prod's logs for `register-pr: mapping recorded ... owner=<slug>`.

### Diagnosing "the bot didn't respond"

```bash
# 1. Did the webhook arrive at canonical?
grep "github-webhook" /home/ubuntu/slang-coworkers-prod/nanoclaw/logs/nanoclaw.log | tail -10

# 2. What did canonical do with it?
#    'forwarded to foreign'  → check peer
#    'delivered via PR mapping' → check the mapped session's inbox
#    'delivered to orchestrator' → check orchestrator outbound

# 3. Token-related issue?
grep "eyes reaction non-OK" /home/ubuntu/slang-coworkers-prod/nanoclaw/logs/nanoclaw.error.log | tail
grep "post-review.sh" /home/ubuntu/slang-coworkers-prod/nanoclaw/logs/nanoclaw.log | tail

# 4. Is the target session's container running?
docker ps --filter name=nc-prod | grep <session-id>
# If not: 60s sweep will wake; or check inbound.db for stuck pending rows.
```

### Backfilling a mapping for a legacy PR

PRs created before the mapping system existed (pre-2026-05-28) have no row, so they fall to orchestrator on every comment. To fix:

```bash
# Decide which session should own it. Then on the canonical instance:
SECRET="..."  # from .env
BODY=$(printf '{"repo":"<repo>","pr_number":<n>,"owner_instance":"<slug>","agent_group_id":"<ag>","session_id":"<sess>","thread_id":null}')
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')"
curl -sS -H "X-Internal-Signature-256: $SIG" -H "Content-Type: application/json" \
  -d "$BODY" http://127.0.0.1:3841/internal/register-pr
```

### Rolling back

The schema migration (027) is forward-only; the `owner_instance` column has a default of `'prod'` so disabling cross-instance routing just means setting `INSTANCE_FORWARD_TARGETS` to empty (no forwards) and accepting that everything routes locally on canonical.

## Reference: PRs that built this

- #491 — `pr_session_mappings.owner_instance` schema + `/internal/register-pr` endpoint
- #493 — Forward to peer when foreign-owned (`INSTANCE_FORWARD_TARGETS`)
- #494 — Coworker Step 0 posts 👀 (deprecated by #500)
- #495 — Orchestrator routing for unmapped PRs + `issues` event support
- #496 — Drop legacy fanout / `WEBHOOK_REQUIRE_MAPPING` / host-eyes (host-eyes was restored in #500)
- #500 — Restore deterministic host-side 👀 reaction
- #501 — `ROUTE_ISSUES_TO` dev-routing flag for `issues` events
- #502 — Slang reviewer posts back to GitHub when authorized
- shader-slang/slang-skills #35, #36 — `cleanup.sh` / `post-review.sh` / `post-back.sh` helpers in slang-pr-review-runner
