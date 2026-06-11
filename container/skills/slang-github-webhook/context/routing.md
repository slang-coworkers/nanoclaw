## GitHub webhook routing

You receive `kind: webhook` messages with `content.event: "github.pr_mention"` when a GitHub user mentions the install's bot in a PR or issue comment.

**Your job is routing — pick the right coworker and forward. The coworker handles the GitHub side (commenting, status updates, the work itself).**

### Procedure

1. **Extract** from `content`: `repo`, `issue_number`, `commenter`, `body`, `comment_url`, `is_pr`.

2. **Pick the project's coworkers by repo.** The `{fixer}`, `{reviewer}`, `{triager}` below are the ones in your destinations for that repo's project:

   | repo | fixer / triager / reviewer |
   |------|----------------------------|
   | `shader-slang/slang`, `shader-slang/slang-rhi` | `slang-fixer` · `slang-triager` · `slang-reviewer` |
   | `shader-slang/slangpy` | `slangpy-fixer` · `slangpy-triager` · `slangpy-reviewer` |

   If a repo isn't listed or its coworkers aren't in your destinations, handle it yourself or escalate.

3. **Resolve owner — in order:**

   a. **PR → session map** (most precise): the host routes mapped PRs automatically. If this webhook reached you, the lookup missed — fall through.

   b. **Branch convention** (`is_pr: true`): a head branch of `fix/issue-<number>` is a coworker PR → `{fixer}`.

   c. **No `fix/issue-` match but `is_pr: true`** (human/fork PR) → `{fixer}` with `MODE=pr-review-fix` and `in_reply_to: <webhook inbound row id>` (required — derives the thread). Add `<github-post-authorized />` only for a real `@nv-slang-bot` mention. Include `REPO`/`PR`/`COMMENT_ID`/`COMMENT_URL`/`COMMENTER` byte-exact.

   d. **Issue (not a PR)** → `{triager}`.

4. **Forward** with `mcp__nanoclaw__send_message(to: "<coworker-name>", text: …)`. Include `repo`, `pr_number`, `comment_url`, and the original comment body. The coworker — not you — owns posting/editing GitHub comments.

### How PR ownership is established

When a coworker creates a PR, **it must call `report_pr_created({ repo, pr_number })`**. That writes to `pr_session_mappings` so future webhook events route to the coworker's session automatically (path 2a). Without it, every follow-up review comment looks orphaned and falls through to branch resolution.

You don't write to this table — it's container-side only via `report_pr_created`. There's no JSON file at `/workspace/agent/pr-mappings.json`; that file was deprecated.
