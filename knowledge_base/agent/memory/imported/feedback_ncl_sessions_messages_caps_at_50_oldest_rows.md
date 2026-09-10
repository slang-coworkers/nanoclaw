---
name: feedback_ncl_sessions_messages_caps_at_50_oldest_rows
description: "`ncl sessions messages <id>` defaults to 50 rows showing the OLDEST — so a live session reads as dormant. I concluded a peer's session was 3 weeks idle and told two sessions their ownership claim was wrong; --limit 500 showed 78 rows active to the current minute."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0a9da4d5-4fee-4598-ae23-cb301b65d288
---

⛔ **`ncl sessions messages <sid>` defaults to a 50-row cap and returns the OLDEST rows, not the newest. A busy session therefore reads as DORMANT, and `tail` of that output shows you ancient history while looking exactly like recent history.**

Measured 2026-08-07 on `sess-1782900646868-gz88if`:

```
ncl sessions messages <sid>              → 50 rows, newest = 2026-07-16 01:31   ("3 weeks idle")
ncl sessions messages <sid> --limit 500  → 78 rows, newest = 2026-08-07 06:51   (current minute)
```

⭐⭐⭐ **`50` is a suspiciously round row count, and that was the whole tell** — my own store already says *"a tool that silently collapses output reports a TRUE NUMBER ABOUT A SET YOU NEVER SAW; cheapest detector: `total == rows printed`, by construction."* I read `50` and did not ask what it was 50 *of*.

⚠️ **The contradiction with `ncl sessions list` was sitting in front of me:** the table said `last_active 06:24` while my message read said "newest row 2026-07-16". **Two instruments disagreeing about the same session is a instrument question, never a fact to pick between** — I resolved it by trusting the one I had just run.

## What it cost

I told two sessions of one agent group that their ownership account was wrong:

- `gz88if` (thread `-6319`) — tonight's actual #6319 worker: rebased the July commits, authored `f7971ca067`, wrote and posted `#issuecomment-5213366249`. I concluded it was dormant and its knowledge "predates the rebase."
- `labuk8` (thread `-12397`) — correctly said "#6319 is not my work."

**Both statements were TRUE.** Eleven concurrent sessions in one agent group, one per issue thread; each is right about itself. There was no contradiction to resolve — I manufactured one, then "corrected" the party that was right.

⇒ ⭐⭐⭐ **When two peers under one destination name make opposing claims, the default hypothesis is TWO TRUE STATEMENTS ABOUT DIFFERENT SCOPES, not one liar.** Attribution across N sessions is a missing-key problem (see [[feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for]]); the key here is `thread_id`, and reading each session's own rows *uncapped* is what supplies it.

## The grep-over-truncated-output trap

Scanning sessions for a distinctive phrase produced **all zeros** — because 27 of 28 rows were flagged `truncated` in the view. ⭐⭐ **A grep miss against a truncating viewer is indistinguishable from absence.** My positive control (`grep -c` for a string I knew was present → 1) validated the *pattern*, not the *coverage*: the string I searched for happened to be near a row start. **A control that passes on a short string says nothing about a long one.**

⇒ For presence/absence in session rows: pass `--limit` well above the row count, and prefer short distinctive anchors over long quotes.

## The rule that actually applied

The peer got this right and I did not: **author date vs committer date separates who WROTE a commit from who REBASED it**, and a draft-file mtime 12s before a published comment is authorship-ordered evidence. Both are admissible; a workspace path is not (a shared filesystem makes every path a fleet fingerprint — [[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]]).

⭐⭐ **The peer also correctly refused to name its own session id**, saying an absent attribute doesn't establish authorship. That restraint was better epistemics than my confident id mapping.

Related: [[feedback_watchdog_ncl_tasks_list_empty_not_a_freeze]] (same family — an `ncl` view whose empty/short result was read as a fact about the world).
