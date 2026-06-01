Generate a daily report draft for the Slang project.

Compute "24 hours ago" as ISO 8601 (today 2026-02-17 → since = "2026-02-16T00:00:00Z"). Check the year.

## Data Collection

You MUST query ALL sources below. Parallelize where possible.

### 1. GitHub (owner=shader-slang, repo=slang)

Issues — paginate each (if `hasNextPage`, re-call with `after=<endCursor>` until false; cap 100):

- `github_list_issues` state=OPEN, first=100, since=<24h ago ISO>
- `github_list_issues` state=CLOSED, first=100, since=<24h ago ISO>

PRs:

- `github_list_pull_requests` state=open / state=closed, per_page=30, sort=updated, direction=desc
- `github_search_issues` q="repo:shader-slang/slang is:pr updated:>=YYYY-MM-DD" (yesterday) to catch PRs missed by the list

Discussions: `github_get_discussions` owner=shader-slang, repo=slang, first=10

### 2. GitLab (project_id="6417")

- `gitlab_list_issues` state=opened, per_page=20, order_by=updated_at
- `gitlab_list_merge_requests` state=opened, per_page=20, order_by=updated_at

### 3. Discord (7 channels, parallel)

`discord_read_messages` limit=50 for each configured channel.

### 4. Slack

`slack_get_channel_history` configured channel_id, limit=100, since=<24h ago ISO>

### 5. User ID Resolution

Resolve each unique Slack user ID via `slack_get_user_profile` **sequentially** (not parallel) to avoid rate limits.

---

## Report Structure

1. **Urgent Matters** (limit 3, prioritized): 🚨 critical, ⚠️ blocking, 🔄 time-sensitive. Include action items/owners.
2. **GitHub Activity (24h)**: new issues opened, issues/PRs closed, PRs requiring review — each with title + URL; 🚨 high-priority. Lists, not tables.
3. **GitLab Activity**: notable open issues + MRs, with GitLab base URL links.
4. **Key Discussions** (limit 3 most impactful): from Slack/Discord/GitHub Discussions — technical decisions, architecture, process. Include context + next steps.
5. **Progress Updates**: active development (major features, milestones); infrastructure (build/CI status, nightly statuses from Slack).
6. **Notes & Reminders**: announcements, deadlines, best practices.

---

## Format Requirements

- Hierarchical headings (##, ###); bullets for scanning
- Unicode emoji (🚨 ✅ ❌ ⚠️ 🔄), NOT shortcodes — shortcodes only render on Slack/GitHub
- Resolve user ids to names + emails when correlating across GitHub/Slack/etc.; use only names/usernames present in the input, prefer full names
- Direct links to referenced items; highlight action items/decisions; add report-generation timestamp
- Professional but conversational tone

Save as 'daily-report-YYYY-MM-DD.md', overwriting if it exists (append `_updated` only if you need both versions).

## Completeness Checklist

Verify you queried: GitHub issues (open + closed, paginated), GitHub PRs (open + closed), GitHub Discussions, GitLab issues + MRs (project 6417), all 7 Discord channels, Slack history (with since filter), all Slack user IDs resolved. Note any failed/errored source under "Data Collection Notes" at the bottom.
