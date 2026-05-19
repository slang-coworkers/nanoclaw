---
name: slang-github-webhook
license: MIT
description: "Handle @nv-slang-bot PR mention webhooks: post a single editable TODO-list comment, route to coworkers via send_message, edit the comment on every status change."
provides: [github.webhook.routing]
allowed-tools: Bash(gh:*), Bash(jq:*), Bash(date:*), Bash(mkdir:*), Bash(echo:*), Bash(cat:*), mcp__nanoclaw__send_message
---

# Slang GitHub webhook routing

Use this skill when you receive a `kind: webhook` message with `content.event: "github.pr_mention"`.

## Operating principles

- **One comment per webhook task.** Never POST a second comment for the same task — PATCH the first one. A new POST happens only when a fresh `kind: webhook` inbound arrives.
- **The comment is a live TODO list.** Each step you intend to do becomes a checklist item; you update its status in real time so the human reviewer sees progress without you having to spam.
- **Use `mcp__nanoclaw__send_message` to route to coworkers.** Do not use inline `<message to="…">` blocks for this skill — the tool call is explicit, auditable, and avoids the mixed-syntax footgun.
- **Verify rapid follow-up webhooks** before acting on them.

## Flow

### 1. Parse the webhook

```json
{
  "event": "github.pr_mention",
  "repo": "shader-slang/slang",
  "issue_number": 1234,
  "is_pr": true,
  "comment_id": 9876543,
  "commenter": "some-user",
  "body": "@nv-slang-bot please fix ..."
}
```

Task text = everything in `body` after `@nv-slang-bot`.

### 2. Build a TODO list for this task

Decompose the task into 2–6 concrete steps. Example for a code-fix request:

```
- [ ] Read PR diff and surrounding files
- [ ] Identify root cause
- [ ] Write fix
- [ ] Run tests / typecheck
- [ ] Push commit
```

Or for a question/review:

```
- [ ] Read the PR
- [ ] Answer
```

### 3. Post the comment ONCE — capture its id

The first POST contains the full TODO list. All future updates PATCH this same comment.

```bash
COMMENT_DIR=/workspace/agent/.gh-comments
mkdir -p "$COMMENT_DIR"
COMMENT_FILE="$COMMENT_DIR/{repo}-{issue_number}.id"

INITIAL_BODY=$(cat <<'EOF'
👋 @{commenter} — on it.

**Working on it:**
- [ ] Read PR diff and surrounding files
- [ ] Identify root cause
- [ ] Write fix
- [ ] Run tests / typecheck
- [ ] Push commit

_(Last updated: $(date -u +%Y-%m-%dT%H:%MZ))_
EOF
)

COMMENT_ID=$(jq -Rsn --arg b "$INITIAL_BODY" '{body: $b}' \
  | gh api repos/{repo}/issues/{issue_number}/comments --method POST --input - --jq '.id')
echo "$COMMENT_ID" > "$COMMENT_FILE"
```

### 4. Edit the comment on every status change

Every time you complete (or start, or block on) a step, PATCH the same comment. Mark items `- [x]` when done; add a one-line status note under the list when something is in progress or blocked.

```bash
COMMENT_ID=$(cat "/workspace/agent/.gh-comments/{repo}-{issue_number}.id")

UPDATED_BODY=$(cat <<'EOF'
👋 @{commenter}

**Status:** pushing fix now

- [x] Read PR diff and surrounding files
- [x] Identify root cause — `validateInput` was missing the null check at line 47
- [x] Write fix
- [x] Run tests / typecheck — all green
- [ ] Push commit

_(Last updated: $(date -u +%Y-%m-%dT%H:%MZ))_
EOF
)

jq -Rsn --arg b "$UPDATED_BODY" '{body: $b}' \
  | gh api "repos/{repo}/issues/comments/$COMMENT_ID" --method PATCH --input -
```

(Use `--input -` with `jq -Rsn`; `--field body=` mis-handles bodies starting with `@`.)

When the task is fully done, the final PATCH replaces the in-progress status with the result and a summary.

### 5. Resolve branch and route to a coworker (PRs only)

If the PR's head branch matches `dev/<folder>/`, the folder names a coworker. Forward the work to them and update your TODO comment to reflect the routing:

```bash
BRANCH=$(gh api repos/{repo}/pulls/{issue_number} --jq '.head.ref')
COWORKER=$(echo "$BRANCH" | sed -n 's|^dev/\([^/]*\)/.*|\1|p')
```

If `COWORKER` is non-empty, send a coworker dispatch via the MCP tool (NOT inline `<message to>`):

```
mcp__nanoclaw__send_message(
  to: "{coworker}",
  text: "GitHub PR mention from @{commenter} on {repo}#{issue_number}.\n\nTask: {task text}\n\nPR: {comment_url}\nBranch: {branch}\n\nWhen you reply on GitHub, edit comment id {COMMENT_ID} (path /workspace/agent/.gh-comments/{repo}-{issue_number}.id) — do not POST a new comment."
)
```

Then PATCH your TODO comment so the reviewer sees the handoff:

```
👋 @{commenter} — routed to `{coworker}`. Updates will appear here.

- [x] Resolve branch (`{branch}` → `{coworker}`)
- [ ] Coworker reads PR
- [ ] Coworker writes fix
- [ ] Coworker pushes commit
```

If `COWORKER` is empty (no matching folder, or `is_pr` is false), handle the task directly without a forward.

### 6. Verify rapid follow-up webhooks

If a second `pr_mention` arrives on the same PR within ~60 seconds of one you just acknowledged, verify before acting on it:

```bash
gh api repos/{repo}/issues/comments/{comment_id} --jq '{user: .user.login, body, created_at}'
```

404 or `user.login != commenter` → the webhook is unverified (engine bug, replay, or stale event). Ignore it and log the discrepancy. The first webhook in a task is trustworthy; verification only matters for rapid follow-ups.

### 7. New webhook → new comment

A fresh `kind: webhook` inbound = a new task = a new POST and a new TODO list. Save the new `comment_id` over the old one in `/workspace/agent/.gh-comments/{repo}-{issue_number}.id`. The previous comment stays untouched as a record of the prior task.

## PR → session mapping

Coworkers that create PRs on delegated tasks must report back so future webhook events route to them.

After creating a PR, the implementer sends back via `mcp__nanoclaw__send_message` to the orchestrator:

```
PR_CREATED: repo=shader-slang/slang pr=456
```

The orchestrator maintains `/workspace/agent/pr-mappings.json`:

```json
{
  "mappings": [
    {
      "repo": "shader-slang/slang",
      "pr_number": 456,
      "implementer": "implementer-1",
      "thread_id": "task-xyz",
      "created_at": "2026-05-08T12:00:00Z"
    }
  ]
}
```

On webhook arrival, look up `(repo, issue_number)` in the mappings file BEFORE falling through to branch resolution. If found, route with the stored `thread_id` so the message lands in the implementer's existing session. On `PR_CREATED:` callbacks, append to the mappings file.
