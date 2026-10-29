---
type: technique
name: technique_find_the_owner_of_a_bot_filed_issue_before_dispatching
description: "Lookup ladder Main runs on an issue_opened webhook for a bot-filed issue before dispatching anything: issue timeline + parent PR body, canonical-thread and PARENT-thread session grep (--limit 10000), own transcript (--full), conversations/*.md signature grep, ncl tasks (grep the PARENT, then get), parent PR's latest verdict, the owning fixer session's newest rows, the sibling Main's outbound rows. Any hit = owned, dispatch nothing. Dated cases in technique_find_the_owner_of_a_bot_filed_issue_case_log."
metadata:
  node_type: memory
  type: technique
---

# Find the owner of a bot-filed issue before dispatching

A bot-filed issue (`nv-slang-bot[bot]`) is almost always the byproduct of a live chain: a
coworker filed it on someone's order, and the webhook is that filing echoing back. Every
GitHub-side freshness check passes it (open, 0 comments, body = payload), so the routing
question is **who already owns it**, answered from our own state. The rule this serves is
[[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]]. The dated cases each rung
came from are in [[technique_find_the_owner_of_a_bot_filed_issue_case_log]].

Run the rungs cheapest first. **Any hit means it is owned: dispatch nothing.**

0. **The issue timeline and the parent PR body.** `gh api repos/<o>/<r>/issues/<N>/timeline`: a
   `cross-referenced` event from a live bot PR (#13682) or a `referenced` event from a commit
   (#13683) settles ownership in one call. Also grep the parent PR body for `#<N>`. Re-run this
   after any poll below times out, not only before it.
1. **Canonical-thread session, for the new number AND the parent named in the body.**
   `ncl sessions list --limit 10000 | grep <N>` (or `--agent-group <gid> --limit 5000`). A 2000-row
   list stops before August-era parent threads (#13580/#13581). A recipient session other than my
   own webhook session means it is routed (#13313).
2. **My own transcript, with `--full`.** `ncl sessions messages <sid> --full | grep <N>`. The
   default 300-char truncation gave a false zero on a session holding three mentions (#12462).
3. **`conversations/*.md`, grepped for the body's signature string, not only the number.** It holds
   sibling Main sessions' final `<message>` blocks, so it finds a dispatch without reading an old
   session through `ncl` (the wedge hazard; #13327). A bot filing can execute a *conditional* order
   from weeks earlier (slangpy#1223, a 13-day-old "file it on the 3rd occurrence").
4. **`ncl tasks list`, grepped for the PARENT issue, then `ncl tasks get` each hit.** The list
   column truncates prompts (#13359). If a re-chase task already names the issue, extend it with
   `ncl tasks update` instead of arming a second one that races it (#13314, #13656, #13727).
5. **The body's origin, not the new number.** A "file it, then fix" order did not have its number
   when written; grep for the PR, function, or error string the body cites (#13329).
6. **The parent PR's latest review verdict.** A "no tracking issue" nit, or a maintainer's "or file
   a follow-up", means the fixer is filing it (#13405, #13727). It is owned before the report lands.
7. **The owning fixer session's newest ~10 rows.** A fresh filing order sits in the fixer's session
   on the PARENT's thread, so this rung often hits before rung 1 (#13404, #13628). ⛔
   `ncl sessions messages --json` rows carry **`text`**, not `content` (keys: `seq, direction,
   kind, timestamp, text, truncated`); print one row's keys before filtering, or an empty filter
   reads as "nothing there".
8. **A sibling Main that has the filing report but hasn't answered: poll its `messages_out`**
   (10 s poll, ~5 min cap) instead of dispatching in parallel (#13301). Two Mains dispatching one
   issue produce duplicate fixer work on one thread. **If the poll ends and the sibling still hasn't
   decided, this webhook session decides and reports once; it does not keep waiting** (#13560,
   #13582).

## When it is owned but parked

"Not a triage" is not "nothing to do". The answers are dispatch / no-op / **build the resume
trigger the chain lacks**. A self-filed decision request waits on a human, so it needs a resume
path ([[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]).

- ⛔ **Never arm a *recurring* per-issue gate** (supervise-issues R10, since 2026-10-13): webhooks
  already deliver the issue's comment and close events, and a per-issue cron never cancels itself.
  Use one `--process-after` re-check, an entry in the parked-chain register, or — preferred — fold
  the issue into the parent's existing re-chase task with `ncl tasks update`, which keeps the
  operator to one 5-bullet. The `iNNNNN-*-gate` recurring tasks in the case log predate the rule.
- **A sibling Main that reports a park usually arms nothing.** After rung 8, run
  `ncl tasks list | grep <N>` every time (#13531, #13533).
- **A terminal close of the parent can remove the only watcher.** When a sibling closes the parent
  chain and cancels its re-chase, check whether a filed `regression` issue is left with no resume
  path (#13628: one `--process-after` keyed on the next release containing the fix commit).
- **An issue waiting on an upstream change resumes on that change's artifact too**, not only on
  the thread (#13407: the `external/glslang` SHA moving can land silently in someone else's PR).
- **Gate controls:** a HUMAN_REPLY control needs a cutoff *earlier* than a known human comment
  (`GATE_SINCE=2026-10-01` on #13433 → `true`); using the gate's own SINCE correctly reads quiet and
  looks like a broken gate. A CLOSED control (#12457) must read `true`, and bot-only-comment issues `false`, so our own bot cannot
  self-trigger it.

### 2026-10-19, #13753: two Mains each waited, then each dispatched, 26 s apart
The reporter filed #13753 at our request on #13633. Its webhook created Main `w5ihka`; the #13633 comment created traffic on my #13633 Main. At 20:16Z `w5ihka` posted "the sibling #13633 Main has not acted yet". I read that as "it is waiting on me" and dispatched at 20:18:30Z. It had already sent its own triage request at 20:18:04Z. The triager merged the two (its msgs 2+4) and its parent edge is `w5ihka`, so there was no harm this time. ⇒ **A sibling saying it is waiting is not a hand-off.** Before dispatching from the second Main, re-list `--thread-id gh-issue-<repo>-<N>` for a *recipient* session **immediately** before the send, not 2 min earlier. Better: let the issue's own webhook Main own the new issue, and have the other Main only relay its own thread's comment.
2026-10-20 follow-up: jkwak-work assigned jhelferty-nv and set the Q4 milestone on 10-19, so Decision 3 ("fixer now or wait") was closed on GitHub before the operator answered it. The reporter's 10-20 comment (more crashing shapes; `-no-codegen` passes, so the fault is in IR specialization) arrived as `pr_mention` but @-mentioned nobody, so I sent no dispatch and made no post. ⇒ **Before repeating an open operator decision, read the issue timeline (`gh api …/timeline`): an `assigned` or `milestoned` event by a maintainer can close the decision.**
Follow-up: the babysitter confirmed it was the filer at 04:38Z (row 7597), ten minutes after my report. On 10-22, jkwak-work self-assigned #1223 and parked it with "revisit when we have more intermittent failures with more clues" (cmt 6347372414, no bot mention). I relayed that verbatim to the babysitter's main session (`hia2o3`) and made no bot post. The resume path is the babysitter's recurring sweep, which already matches the signature, so no per-issue timer.

### 2026-10-28, #13560: a second maintainer question goes to the same owner session
jkwak-work asked a follow-up with an @-mention: "is the error not observed without the flag?" (cmt 6474445926). The triager session `ll0lo2` had answered the 10-13 question, so it owns #13560 even though its thread is `-13321`. I sent the new question to it with `thread_id=…-13560` and pinned `target_session_id`, and added 👀. ⚠️ The first `send_message` failed with `database is locked`. I confirmed it hadn't landed (no new inbound row in the target session and no out row in mine), then sent it once more and it succeeded.
**Closed 10-28 17:02Z.** The triager posted one reply covering both questions (6474696563): it re-measured on `3218a7612`, cited PR #4240's "shaders known to be correct", and offered a not-planned close. jkwak-work answered "Closing." and closed it as completed. I made no dispatch and no GitHub post, because the maintainer closed it on our own proposal and a closing bot comment would only add churn. The [Resolution] went to the operator only.
