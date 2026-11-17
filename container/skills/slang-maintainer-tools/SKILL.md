---
name: slang-maintainer-tools
license: MIT
description: 'Bridge from /slang-maintain workflow steps to concrete slang-mcp tool calls. Read-only. Task recipes live in sibling files.'
provides: []
argument-hint: '[task: daily-report|release-notes|issue-prioritization|review-messages]'
allowed-tools: Read Write Edit Grep Glob mcp__slang-mcp__github_list_pull_requests mcp__slang-mcp__github_get_pull_request mcp__slang-mcp__github_get_pull_request_comments mcp__slang-mcp__github_get_pull_request_reviews mcp__slang-mcp__github_list_issues mcp__slang-mcp__github_search_issues mcp__slang-mcp__github_get_issue mcp__slang-mcp__github_get_discussions mcp__slang-mcp__gitlab_list_merge_requests mcp__slang-mcp__gitlab_list_issues mcp__slang-mcp__gitlab_get_file_contents mcp__slang-mcp__discord_read_messages mcp__slang-mcp__slack_get_channel_history mcp__slang-mcp__slack_get_user_profile
---

# Slang Maintainer Tools

Bridges `/slang-maintain` (WHAT) to concrete `slang-mcp` calls (HOW). Read-only.

## Pick a task

Each recipe is self-contained: data sources, pagination rules, output template.

| Task                   | Recipe                                               |
| ---------------------- | ---------------------------------------------------- |
| `daily-report`         | [daily-report.md](./daily-report.md)                 |
| `release-notes`        | [release-notes.md](./release-notes.md)               |
| `issue-prioritization` | [issue-prioritization.md](./issue-prioritization.md) |
| `review-messages`      | [review-messages.md](./review-messages.md)           |

## Step bridge

| `/slang-maintain` step | Where to look in the recipe file      |
| ---------------------- | ------------------------------------- |
| **Collect**            | "Data Collection" section             |
| **Synthesize**         | categorization / dedup rules          |
| **Deliver**            | "Report Structure" or "Output Format" |

Cross-cutting pitfalls (rate limits, pagination, user-id resolution, squash-merge quirks): [gotchas.md](./gotchas.md).

## Discord is read-only

You read Discord channels and threads to report on them; you never post in them. The one Discord post a
maintainer makes is the weekly PR report, delivered by `/slang-pr-report` to its configured channel.
Answering community questions belongs to the slang-discord-support coworker, which replies only when a
thread's author summons it. When a thread needs an answer, or a bug report needs details from its author,
list it in your report with the thread link and what to ask, and the operator routes it. For example, a
reporter whose `slangd` bug lacks a repro goes into the report as "ask for a minimal `.slang` file and the
`slangd` version", not into a reply in their thread.
