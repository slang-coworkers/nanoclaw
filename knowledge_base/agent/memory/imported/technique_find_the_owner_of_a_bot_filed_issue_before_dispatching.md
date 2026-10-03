---
type: technique
name: technique_find_the_owner_of_a_bot_filed_issue_before_dispatching
description: "Lookup ladder Main runs on an issue_opened webhook for a bot-filed issue before dispatching anything: canonical-thread session grep, own transcript (--full), conversations/*.md, ncl tasks (grep the PARENT, then get), origin grep, parent PR's latest verdict, the owning fixer session's newest rows, and the sibling Main's outbound rows. Any hit = already owned, so dispatch nothing. Split out of feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new on 2026-10-03."
metadata:
  node_type: memory
  type: technique
---

# Find the owner of a bot-filed issue before dispatching

A bot-filed issue (`nv-slang-bot[bot]`) is almost always the byproduct of a live chain: a
coworker filed it on someone's order. The webhook is that filing echoing back. Every
GitHub-side freshness check passes it (open, 0 comments, body = payload), so the routing
question is **who already owns it**, answered from our own state. The rule this serves is
[[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]].

Run the rungs cheapest first. **Any hit means it is owned: dispatch nothing.**

1. **Canonical-thread session.** `ncl sessions list --limit 2000 | grep gh-issue-<owner>/<repo>-<N>`.
   A recipient session other than my own webhook session means it is routed (#13313: a triager
   session already ran with a full brief that no Main transcript I grepped contained).
2. **My own transcript, with `--full`.** `ncl sessions messages <sid> --full | grep <N>`. The
   default 300-char truncation gave a false zero on a session holding three mentions (#12462: the
   filing report was in my own #12442 session, on my own "take it to triage" order).
3. **`conversations/*.md`.** It holds sibling Main sessions' final `<message>` blocks, so it finds
   the owner's dispatch without reading an old session through `ncl` (the wedge hazard; #13327, an
   11-day-old #13169 session). A missing fixer session on the canonical thread does not mean
   unrouted: the hand-off can land in the fixer's existing session on the parent's thread.
4. **`ncl tasks list`, grepped for the PARENT issue, then `ncl tasks get` each hit.** The list
   column truncates prompts (#13359: no hit on the new number or the named PR; the parent #13350's
   re-chase task covered it in full). If a re-chase task already names the issue, extend it with
   `ncl tasks update` instead of arming a second one that races it (#13314).
5. **The body's origin, not the new number.** A filing ordered as "file it, then fix" did not have
   its number when the order was written; grep for the PR, function, or error string the body cites
   (#13329: `slangpy/pull/1088` led to the dispatch on another issue's sub-thread).
6. **The parent PR's latest review verdict.** A "no tracking issue" nit means the fixer is filing
   it (#13405: R3 nit FG010). It is owned before the filing report arrives.
7. **The owning fixer session's newest ~10 rows.** When the filing chain is known, the hand-off
   lands there, not on the new issue's thread (#13404). ⛔ `ncl sessions messages --json` rows carry
   **`text`**, not `content` (keys: `seq, direction, kind, timestamp, text, truncated`); print one
   row's keys before filtering, or an empty filter reads as "nothing there".
8. **A sibling Main that has the filing report but hasn't answered: poll its `messages_out`**
   (10 s poll, ~5 min cap) instead of dispatching in parallel (#13301). Two Mains dispatching one
   issue produce duplicate fixer work on one thread.

## When it is owned but parked

"Not a triage" is not "nothing to do". The answers are dispatch / no-op / **build the resume
trigger the chain lacks**. A self-filed decision request waits on a human, so it needs a gate
([[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]); #12462 got
`i12462-maintainer-gate`, proven on controls including open bot-only-comment issues → `false` so our
own bot cannot self-trigger it. An issue waiting on an upstream change gates on **that change's
artifact** too, not only the thread (#13407: `i13407-glslang-bump-gate` also fires when the
`external/glslang` SHA moves off `d1f52c8`, since the bump can land in someone else's PR silently).
