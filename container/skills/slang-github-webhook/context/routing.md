## GitHub webhook messages

When you receive a message with `kind: webhook` and `content.event: "github.pr_mention"`, a GitHub user has mentioned `@nv-slang-bot` in a PR or issue comment.

### Routing procedure

1. **Extract fields** from the message content:
   - `repo` — e.g. `shader-slang/slang`
   - `issue_number` — PR/issue number
   - `commenter` — GitHub login of the commenter
   - `body` — the comment text (everything after the bot mention is the request)
   - `comment_url` — direct link to the comment

2. **Resolve the PR branch** (only when `is_pr: true`):
   ```bash
   gh api repos/{repo}/pulls/{issue_number} --jq '.head.ref'
   ```
   Branch convention: `dev/<coworker-folder>/...` routes to that coworker.
   If no match or not a PR, handle the request yourself.

3. **Forward to the coworker** (if branch matches): use `mcp__nanoclaw__send_message(to: "<coworker-name>", text: …)` to deliver the request. Include the original comment body, repo, PR number, and comment URL so the coworker has full context. Tell the coworker that all status updates and the final reply must be made by editing the GitHub comment captured in `/workspace/agent/.gh-comments/{repo}-{issue_number}.id` — never POST new comments within the same webhook task.

4. **Acknowledge on GitHub by posting ONE comment** containing the initial TODO list, and capture its `comment_id`:
   ```bash
   gh api repos/{repo}/issues/{issue_number}/comments \
     --method POST \
     --field body="…initial TODO list…" --jq '.id'
   ```
   All later updates within this webhook task PATCH the same comment via `gh api repos/{repo}/issues/comments/{comment_id} --method PATCH`. Never POST a new comment for progress within the same task.

5. **On completion**, do the final PATCH that replaces the in-progress status with the result + summary. The same comment becomes the audit trail of the work done.

### PR → session mapping (webhook round-trip routing)

When you delegate a task that may result in a PR, you need to track which coworker owns which PR so that future webhook events for that PR route back to the correct session.

**Protocol:**

1. **Before forwarding**, record the delegation in `/workspace/agent/pr-mappings.json`:
   ```json
   { "thread_id": "<your-thread_id>", "implementer": "<coworker-name>", "repo": null, "pr_number": null }
   ```

2. **When implementer reports PR creation** (message containing `PR_CREATED: repo=<owner/repo> pr=<number>`), update the mapping:
   ```json
   { "thread_id": "task-xyz", "implementer": "implementer-1", "repo": "shader-slang/slang", "pr_number": 456 }
   ```

3. **On subsequent webhook arrival** for the same PR number:
   - Read `/workspace/agent/pr-mappings.json`
   - Look up by `(repo, pr_number)`
   - If found: `mcp__nanoclaw__send_message(to=mapping.implementer, thread_id=mapping.thread_id, text=<webhook context>)`
   - If not found: fall through to branch-prefix resolution (step 2 above)

This ensures the webhook lands in the implementer's existing per-thread session with full prior context, rather than starting a fresh session.
