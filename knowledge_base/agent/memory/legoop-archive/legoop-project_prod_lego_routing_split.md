---
type: project
title: "prod forwards issue OPENS to lego but processes issue COMMENTS itself — not duplicate work"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# prod forwards issue OPENS to lego but processes issue COMMENTS itself — not duplicate work

prod/lego GitHub webhook split (as of 2026-06-02 audit):

- prod `.env`: `INSTANCE_SLUG=prod`, `ROUTE_ISSUES_TO=lego`, `INSTANCE_FORWARD_TARGETS=lego=http://127.0.0.1:3843/webhook/github`. lego `.env`: `INSTANCE_SLUG=lego` (receiver, no ROUTE_ISSUES_TO — never forwards).
- prod dev-routes issue **opens** (`github.issue_opened`) to lego (30 routed in current log window), and PR events to foreign owner (6). prod dev-routes issue **comments**: 0.
- The two apparent overlaps (issues 11349, 511 appearing in both prod's dev-route list AND prod's own "delivered to orchestrator") are NOT duplicate work: prod forwarded the issue *open* to lego, but a later *comment* (`github.pr_mention is_pr=false`, ids gh-4576203489 / gh-4591326399) fell through to prod's own orchestrator. lego never received those comment ids — confirmed absent from lego logs.
- So: issue OPENS go to lego, issue COMMENTS stay on prod. This is a routing gap, not duplication — symmetric comment-forwarding (`deliverGitHubMention` ROUTE_ISSUES_TO branch, [[project_issue_comment_mention_gate]] #525) exists in code but prod logged 0 comment-forwards in the window, so follow-up comments on a lego-owned issue chain land on the wrong instance.
- DB note: webhook rows live in `messages_in` with snake_case cols (`channel_type`, `thread_id`), `kind='webhook'`, `channel_type='github'`, row id `gh-issue-<repo>-<num>` (opens) or `gh-<commentId>` (comments). Rows persist (not GC'd). Related: [[project_pr_session_mapping]], [[project_lego_repo_webhook]].

