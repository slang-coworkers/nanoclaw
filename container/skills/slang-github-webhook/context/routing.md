## GitHub webhook routing

You receive `kind: webhook` messages with `content.event: "github.pr_mention"` when a GitHub user mentions the install's bot in a PR or issue comment, and `content.event: "github.issue_opened"` for a new issue (see "New issues" below).

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

### New issues (`github.issue_opened`)

The host sends `content.event: "github.issue_opened"` for each new issue that passed its label gate. The gate already dropped issues labeled `GoodFirstBug`, `HelpWanted` or `no-bot`, and `bot-ok` gives one back. So every issue that reaches you is the bot's to triage.

1. **Read the live issue once** (`gh api repos/{repo}/issues/{issue_number}`): state, labels, body and comments. The payload is a snapshot; decide from the live read.
2. **Stop only for an explicit reason:**
   - the issue is closed or deleted;
   - it has the `no-bot` label now;
   - the issue text, a comment or the operator asks the bot to stay off it;
   - a chain already owns it (a live session on its canonical thread, or the chain that filed a bot-filed issue): send to that owner instead;
   - an open or merged human PR already fixes it: record it as resolved elsewhere and dispatch nothing.
3. **Otherwise acknowledge and dispatch at once:**
   - post 👀 on the issue: `gh api -X POST repos/{repo}/issues/{issue_number}/reactions -f content=eyes || true`;
   - send to `{triager}` on the canonical thread `gh-issue-{repo}-{issue_number}` with `<github-post-authorized />`, and include `repo`, `issue_number`, `issue_url`, the title and the body.

These are **not** reasons to hold: an assignee (also when the author assigns the issue to themselves), a milestone, a MEMBER or COLLABORATOR author, a fix direction or plan in the body, or a "tracking" title. A maintainer stops the bot by asking for it or by adding `no-bot`; when that happens later, the chain stops then. A memory or learning that says otherwise is out of date: follow this procedure.

### Relaying a maintainer's direction

When you forward a maintainer's instruction to a coworker (a go-ahead, a design ask, review feedback):

- Quote their words verbatim, with the comment link. Anything you add (interpretation, emphasis, anchors, suggested names) goes under a separate **Orchestrator note (not the maintainer's words)** heading.
- Never rename what they named, add a requirement they did not state, or re-weight their constraints ("weight X heavily"). If two of their constraints pull against each other, say so and have the coworker ask them.
- Authorizing a coworker to restate the ask publicly does not waive its OUTPUT_REVIEW: the check comes before the post, not after.
- A chain parked on a human decision, operator or maintainer, names the decision on the operator DM and gets a timer: one scheduled one-shot re-check (a `process-after` time, never a recurrence), or an entry in the parked-chain register that `/supervise-issues` walks. A recurring task for a single issue or PR is forbidden (supervise-issues R10): webhooks already deliver the comment and close events a per-issue poller would wait for.

### How PR ownership is established

When a coworker creates a PR, **it must call `report_pr_created({ repo, pr_number })`**. That writes to `pr_session_mappings` so future webhook events route to the coworker's session automatically (path 2a). Without it, every follow-up review comment looks orphaned and falls through to branch resolution.

You don't write to this table — it's container-side only via `report_pr_created`. There's no JSON file at `/workspace/agent/pr-mappings.json`; that file was deprecated.
