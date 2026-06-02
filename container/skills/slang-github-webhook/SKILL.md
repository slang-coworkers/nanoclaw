---
name: slang-github-webhook
license: MIT
description: 'Handle @nv-slang-bot PR mention webhooks: post one editable TODO-list comment, route to coworkers via send_message, edit on every status change.'
provides: [github.webhook.routing]
allowed-tools: Bash(gh:*), Bash(jq:*), Bash(date:*), Bash(mkdir:*), Bash(echo:*), Bash(cat:*), mcp__nanoclaw__send_message
---

# Slang GitHub webhook routing

Use on a `kind: webhook` message with `content.event: "github.pr_mention"`.

## Principles

- **Acknowledge first** (step 0): the picking coworker posts 👀, not the host — exactly one lands per instance.
- **One comment per webhook task.** PATCH the first; POST only on a fresh `kind: webhook` inbound.
- The comment is a **live TODO list** — update in real time, no spam.
- **Route via `mcp__nanoclaw__send_message`**, never inline `<message to="…">` blocks.
- Verify rapid follow-up webhooks before acting (step 6).

## Flow

### 0. Acknowledge with 👀 — before parsing

First action on a `pr_mention`: post 👀 on the triggering comment. Pick the endpoint from `comment_url`:

- contains `#discussion_r` → `repos/{repo}/pulls/comments/{comment_id}/reactions`
- else → `repos/{repo}/issues/comments/{comment_id}/reactions`

```bash
SUB=issues
case "{comment_url}" in *"#discussion_r"*) SUB=pulls ;; esac

gh api -X POST -H "Accept: application/vnd.github+json" \
  "repos/{repo}/$SUB/comments/{comment_id}/reactions" \
  -f content=eyes \
  || echo "(eyes already posted or comment gone — ignore)"
```

The `|| echo` swallows the 422 when a reaction already exists (idempotent). Never block the flow on it.

### 1. Parse the webhook

Fields: `repo` (`<owner>/<repo>`), `issue_number`, `is_pr`, `comment_id`, `commenter`, `body`. Task text = everything in `body` after `@nv-slang-bot`.

### 2. Build a TODO list

Decompose into 2–6 concrete steps. Code-fix: Read diff → Identify root cause → Write fix → Run tests → Push. Question/review: Read PR → Answer.

### 3. Post the comment ONCE — capture its id

First POST contains the full TODO list; all future updates PATCH this same comment.

```bash
COMMENT_DIR=/workspace/agent/.gh-comments
mkdir -p "$COMMENT_DIR"
COMMENT_FILE="$COMMENT_DIR/{repo}-{issue_number}.id"

INITIAL_BODY=$(cat <<'EOF'
👋 @{commenter} — on it.

**Working on it:**
<the step-2 TODO list, all items unchecked>

_(Last updated: $(date -u +%Y-%m-%dT%H:%MZ))_
EOF
)

COMMENT_ID=$(jq -Rsn --arg b "$INITIAL_BODY" '{body: $b}' \
  | gh api repos/{repo}/issues/{issue_number}/comments --method POST --input - --jq '.id')
echo "$COMMENT_ID" > "$COMMENT_FILE"
```

### 4. Edit the comment on every status change

On start/complete/block of any step, PATCH the same comment: rebuild the body (toggle `- [ ]`→`- [x]`, add a one-line **Status:** note, bump the timestamp) and PATCH by id:

```bash
COMMENT_ID=$(cat "/workspace/agent/.gh-comments/{repo}-{issue_number}.id")
jq -Rsn --arg b "$UPDATED_BODY" '{body: $b}' \
  | gh api "repos/{repo}/issues/comments/$COMMENT_ID" --method PATCH --input -
```

(Use `--input -` with `jq -Rsn`; `--field body=` mis-handles bodies starting with `@`.) The final PATCH replaces the in-progress status with the result and a summary.

### 5. Resolve branch and route to a coworker (PRs only)

If the PR head branch matches `dev/<folder>/`, the folder names a coworker.

```bash
BRANCH=$(gh api repos/{repo}/pulls/{issue_number} --jq '.head.ref')
COWORKER=$(echo "$BRANCH" | sed -n 's|^dev/\([^/]*\)/.*|\1|p')
```

If `COWORKER` is non-empty, dispatch via the MCP tool (NOT inline `<message to>`):

```
mcp__nanoclaw__send_message(
  to: "{coworker}",
  text: "GitHub PR mention from @{commenter} on {repo}#{issue_number}.\n\nTask: {task text}\n\nPR: {comment_url}\nBranch: {branch}\n\nWhen you reply on GitHub, edit comment id {COMMENT_ID} (path /workspace/agent/.gh-comments/{repo}-{issue_number}.id) — do not POST a new comment.\n\n<github-post-authorized />\nREPO={repo}\nPR={issue_number}\nCOMMENT_ID={comment_id}\nCOMMENTER={commenter}"
)
```

`<github-post-authorized />` authorizes the receiving coworker to post the result back to GitHub. **Mandatory for `@nv-slang-bot` comment dispatches** — the human tagging the bot is the authorization. The `REPO=`/`PR=`/`COMMENT_ID=`/`COMMENTER=` lines are parsed by the receiving workflow (`grep -oE`); keep the format byte-exact.

For dispatches NOT from an `@nv-slang-bot` mention (internal handoffs, scheduled tasks, chat) **omit the marker** — receiving workflows treat its absence as "return via send_file only, do not post."

Then PATCH your TODO comment to show the handoff (check off "Resolve branch", add coworker-step items). If `COWORKER` is empty (no matching folder, or `is_pr` false), handle the task directly.

### 6. Verify rapid follow-up webhooks

If a second `pr_mention` arrives on the same PR within ~60s of one you just acknowledged, verify first:

```bash
gh api repos/{repo}/issues/comments/{comment_id} --jq '{user: .user.login, body, created_at}'
```

404 or `user.login != commenter` → unverified (replay/stale event). Ignore and log. The first webhook in a task is trustworthy; verification only matters for rapid follow-ups.

### 7. New webhook → new comment

A fresh `kind: webhook` inbound = new task = new POST + new TODO list. Overwrite `comment_id` in `/workspace/agent/.gh-comments/{repo}-{issue_number}.id`; the previous comment stays as a record.

## PR → session mapping

Coworkers that create PRs on delegated tasks must report back so future webhook events route to them. After creating a PR, the implementer sends back to the orchestrator via `mcp__nanoclaw__send_message`:

```
PR_CREATED: repo=<owner>/<repo> pr=456
```

The orchestrator maintains `/workspace/agent/pr-mappings.json` (array of `{repo, pr_number, implementer, thread_id, created_at}`). On `PR_CREATED:` callbacks, append.

On webhook arrival, look up `(repo, issue_number)` in the mappings file BEFORE branch resolution. If found, route with the stored `thread_id` so the message lands in the implementer's existing session.
