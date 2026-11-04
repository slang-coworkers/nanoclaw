---
type: feedback
title: in_reply_to a one-shot task session's report routes to that task session; once it closes, the relay is lost silently
description: Relay later human comments to the chain's owner session (pin target_session_id + in_reply_to=my webhook row), never in_reply_to a system:tasks:* report
tags: [routing, a2a, tasks, in_reply_to]
---

# in_reply_to a closed task session loses the relay

**Rule.** If the last report on a chain came from a one-shot re-check task session (`system:tasks:<id>`), do not relay the
next GitHub comment with `in_reply_to=<that report>`. Send it to the chain's **owner session** instead, pinned with
`target_session_id=<owner>`, `in_reply_to=<my own webhook row>`, and `thread_id=gh-issue-<owner>/<repo>-<num>`.
Afterwards, verify with `ncl sessions messages <owner> --reverse --limit 2`.

**Why.** `in_reply_to` resolves to the source session of the message it points at, which here is the task session.
A task session closes once its fire finishes. A relay sent there afterwards does not land: there is no inbound row, no
dropped-messages row, and no fall-through to the owner, so nothing reports a failure.

**Evidence (#14032, 2026-11-03).**
1. The skiminki-nv comment 6605977963 relay (my row 47, 14:10Z) used `in_reply_to=42`, the t-87db0a task's report.
   That session (`sess-1793294550891-2gw893`) had closed on 11-02 at 18:38Z. The relay was never received.
2. I found this 2 h later, after a container restart. I re-sent it pinned to the owner `sess-1793293942921-jhfet7`,
   and it landed as seq 44.
3. The earlier jhelferty relay (11-02 18:30Z) had landed only because the task session was still open then.
