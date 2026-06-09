## GitHub webhook routing

You receive `kind: webhook` messages with `content.event: "github.pr_mention"` when a GitHub user mentions the install's bot in a PR or issue comment.

**Your job is routing — pick the right coworker and forward. The coworker handles the GitHub side (commenting, status updates, the work itself).**

### Procedure

1. **Extract** from `content`: `repo`, `issue_number`, `commenter`, `body`, `comment_url`, `is_pr`.

2. **Resolve owner — three lookups in order:**

   a. **PR → session map** (most precise): the host queries `pr_session_mappings` and routes to the owning session automatically. If you got this webhook directly, the lookup missed — fall through.

   b. **Branch convention** (when `is_pr: true`): a coworker's PR head branch is `fix/issue-<number>` (set by `/slang-fix-issue`); it no longer encodes the folder, so route a `fix/issue-` head to `slang-fixer`.

   ```bash
   BRANCH=$(gh api repos/{repo}/pulls/{issue_number} --jq '.head.ref')
   case "$BRANCH" in fix/issue-*) COWORKER=slang-fixer ;; *) COWORKER= ;; esac
   ```

   c. **No match** → handle it yourself, or escalate to the user if you can't.

3. **Forward** with `mcp__nanoclaw__send_message(to: "<coworker-name>", text: …)`. Include `repo`, `pr_number`, `comment_url`, and the original comment body. The coworker — not you — owns posting/editing GitHub comments.

### How PR ownership is established

When a coworker creates a PR, **it must call `report_pr_created({ repo, pr_number })`**. That writes to `pr_session_mappings` so future webhook events route to the coworker's session automatically (path 2a). Without it, every follow-up review comment looks orphaned and falls through to branch resolution.

You don't write to this table — it's container-side only via `report_pr_created`. There's no JSON file at `/workspace/agent/pr-mappings.json`; that file was deprecated.
