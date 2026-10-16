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

⛔ **Superseded 2026-10-13: never arm a *recurring* per-issue gate.** CLAUDE.md now forbids it (supervise-issues R10), because webhooks already deliver that issue's comment and close events, and a per-issue cron never cancels itself. Use one `--process-after` re-check, or an entry in the parked-chain register. The recurring `iNNNNN-*-gate` tasks described below come from before the rule. #13560's gate was cancelled once jkwak-work's comment arrived as a webhook.

"Not a triage" is not "nothing to do". The answers are dispatch / no-op / **build the resume
trigger the chain lacks**. A self-filed decision request waits on a human, so it needs a gate
([[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]); #12462 got
`i12462-maintainer-gate`, proven on controls including open bot-only-comment issues → `false` so our
own bot cannot self-trigger it. An issue waiting on an upstream change gates on **that change's
artifact** too, not only the thread (#13407: `i13407-glslang-bump-gate` also fires when the
`external/glslang` SHA moves off `d1f52c8`, since the bump can land in someone else's PR silently).

### 2026-10-08, #13531: rung 8 resolved it inside the 5-min cap
The triager's filing report reached the sibling Main (#13529 session) at 20:08:08Z, a second after the webhook minted
mine. Polling that session's newest rows returned its 5-bullet to the operator at 20:09:43Z, which already said
"No fixer unless a maintainer asks". So dispatch nothing and send no duplicate report. The only gap was a resume
trigger: `i13531-maintainer-gate` (reuses `i13433-decision-gate.sh` with `GATE_ISSUE`/`GATE_SINCE`; controls passed for
HUMAN_REPLY, CLOSED, bot-only → false, and STALE).

### 2026-10-08, #13533: same shape as #13531, closed by rung 7 then rung 8
This was the CUDA reflection side finding from #13530, filed 20:43:29Z. Rung 7 (the triager's newest rows) showed the `[Filed]` report at 20:44:55Z. Rung 8 (the sibling Main's `messages_out`) showed its 5-bullet to the operator at 20:46:23Z, "no fixer; the #13530 chain owns it". So nothing was dispatched and no report was duplicated. The sibling hadn't armed a resume gate, so I added `i13533-maintainer-gate` (wraps `i13433-decision-gate.sh`, STALE 10-13T20:44Z). Controls passed: quiet → false, STALE override → true, CLOSED (#12457) → true, HUMAN_REPLY (#13433) → true, bot-only comments (#13530) → false. ⇒ **A sibling Main that reports a park does not arm its gate: check `ncl tasks list | grep <N>` after rung 8, every time.**

### 2026-10-10, #13560: the filer's report said "routing is your call" and the parent Main didn't answer it
slang-triager filed #13560 (the #13552 R2 follow-up a2b) at 01:03:02Z. Rung 7 found its report at 01:05:15Z, which ended with "#13560 routing is your call". The report went to the dashboard Main session (`9fon2n`), not to the #13321 Main. I polled that session for about 12 minutes. It answered the #13552 residual and the worktree GC, but not #13560. The issue is a maintainer question about a missing diagnostic, low priority, with no miscompile, so I dispatched nothing and armed `i13560-maintainer-gate` (STALE 10-15T01:03Z). Controls: quiet → false, STALE → true, CLOSED (#12457) → true, HUMAN_REPLY (#13321) → true, bot-only → false. Then I sent one 5-bullet to the operator. ⇒ **If rung 8's poll ends and the sibling still hasn't decided, the webhook's own session makes the decision and reports it. It does not keep waiting.**

### 2026-10-12, #13580: rung 1 must grep the PARENT's thread, and `--limit 2000` no longer reaches it
#13580 was the #12737 triager filing on its own Main's 20:30Z order. `ncl sessions list --limit 2000 | grep 12737` (and `--limit 3000`) found only re-chase task sessions. The real owners, the triager's and Main's `gh-issue-…-12737` sessions from 08-25, sit past row 3000 of ~6900. `ncl sessions list --agent-group <triager-gid> --limit 5000 | grep <PARENT>` found them. The triager's `[Triage Resolution]` (21:24Z) and the parent Main's 5-bullet (21:26Z, "the opened-issue sessions are routing them") both left routing to the webhook session, so I dispatched nothing and armed `i13580-maintainer-gate` (STALE 10-15T21:12Z). ⇒ **Run rung 1 for the parent number named in the body as well as the new one, with `--limit 10000` or an agent-group filter.** Gate controls: a HUMAN_REPLY control must set `GATE_SINCE` earlier than the human comment. #13433's only human comment is at 16:27Z, so the gate's own 18:07Z cutoff correctly reads quiet.

### 2026-10-12, #13581: rung 1 on the PARENT number found the owner
Neither `13581` nor `13580` matched any coworker session. Grepping `ncl sessions list --limit 10000` for the parent
(`12737`) found slang-triager's session on the parent's thread, whose newest row was the filing report ("routing for
#13580 and #13581 is your call"), and the parent's Main, which explicitly left routing to the per-issue sessions. The
#13580 sibling Main stayed silent through a 3-min poll, so this session decided: no fixer (overlaps maintainer-owned
#11088, asks a support-scope question) and armed `i13581-maintainer-gate` (STALE 10-17T21:22Z; all five controls passed).
⇒ **Rung 1 greps the parent number as well as the new one, and uses `--limit 10000`, because a 2000-row list can stop before an August-era parent thread.**

### 2026-10-12, #13582: filed on a maintainer's order inside a PR review. Rung 7 found it; rung 8 timed out
slang-fixer filed #13582 at 21:22:28Z on jkwak-work's #13378 R7 order ("file a new issue … this PR should stay away from `in/out/inout`"). Its `[Filed]` report (row 153, 21:23Z) went to the dashboard Main, which was busy with #13580/#13581 and still hadn't decided after a 5-min poll. So this session armed `i13582-maintainer-gate` (STALE 10-17T21:22Z) and reported. ⚠️ **A HUMAN_REPLY control needs a cutoff earlier than a known human comment.** Using #13433 with its own gate's SINCE (the bot's reply time) returns `false`, which is correct, because no human has commented since. That reads like a broken gate. Use `GATE_SINCE=2026-10-01` → `true`.

### 2026-10-13, #13560: the maintainer's question came in as a webhook, so the gate was redundant
jkwak-work asked "Is this dup to #13323?" (cmt 6151135410). I added 👀, cancelled `i13560-maintainer-gate-e1cc`, and sent the question to slang-triager on `gh-issue-shader-slang/slang-13560`, pinned to its #13321-thread session `ll0lo2`, which holds the dedup package. The note I sent with it, which I hadn't verified: #13323 crashes *after* E38037, and #13560 never reaches E38037. They share a backstop, so they're likely related but not duplicates.

### 2026-10-15, slangpy#1223: rung 3 found a 13-day-old conditional order
No session, task or coworker row named #1223 or its PRs. `grep -l "query exhaustion" conversations/` found my 10-02 order to slang-ci-babysitter: "file a slangpy issue once a 3rd post-fix occurrence lands, aimed at skallweitNV, not a fixer". The babysitter acknowledged it ("<3, not filed"), and #13626's 10-14 hit was the third. The body matches the order's shape (links #1072/#1124, names the CHECK, no fix, no ping). The babysitter's filing report had not landed after a 3-min poll. I dispatched nothing and reported to the operator. ⇒ **A bot filing can execute a conditional order from weeks earlier, so grep `conversations/` for the body's signature string, not only for the new number.**

### 2026-10-15, #13628: rung 8 resolved it in ~80 s, but the sibling's terminal report also removed the only watcher
slang-fixer filed #13628 (the #13537 source-break `regression`) and #13629 at 06:30Z on the dashboard Main's 05:50Z order. Rung 7 found the `[Report]` at 06:31:36Z. Rung 8's poll found the dashboard Main's 5-bullet at 06:32:53Z ("maintainers triage and assign", nothing queued for the bot). It also **cancelled `rechase-pr13537-decision-4f69`**, so after that nothing watched the filed regression before the next release. I dispatched nothing and sent no duplicate report. I armed one `--process-after` check, `i13628-triage-recheck` (10-17T06:30Z), whose trigger is a release newer than v2026.19 that contains `a5a87a1236`. ⇒ **When a sibling closes the parent chain as terminal and cancels its re-chase, check whether a filed `regression` issue is left with no resume path.**

### 2026-10-15, #13628/#13629: the #13537 merge follow-ups. Rung 7 then rung 8 settled it in about 2 minutes
The dashboard Main told slang-fixer to file both leftovers at 05:50Z, right after the merge. The fixer's `[Report]` was the newest row in its `gh-issue-…-13537` session (06:31:36Z). The dashboard Main's terminal 5-bullet followed at 06:32:53Z and said "maintainers triage and assign; nothing queued for the bot". It cancelled `rechase-pr13537-decision-4f69` and armed no re-check, so I dispatched nothing and armed one `--process-after` re-check for 10-20, not a recurrence. ⇒ **A fresh filing order sits in the fixer's session on the PARENT's thread, so rung 7 finds it before rung 1 does.**

### 2026-10-15, #13656: the filing order itself said "this session owns the self-echo"
The #13639 Main ordered slang-triager to file the `__constref P` ← `ConstantBuffer<P>` typeflow segfault "file-only, I'll route it afterwards; its `issue_opened` webhook will come back as a self-echo, and this session owns it". Rung 7/8 found the `[Report]` (14:34:55Z) and the sibling's 5-bullet to the operator (14:35:23Z) naming Decision 3 (fixer now vs wait for a maintainer to pick the layer), default unrouted. It armed no re-check for #13656, so instead of a new task I extended the sibling's existing `rechase-13639-pr13646-cdc2` (10-17 14:00Z) with a Decision 3 branch, which keeps it to one 5-bullet. ⇒ **When the parent's re-chase already reports to the same operator thread, fold the new issue into it with `ncl tasks update`; don't arm a second timer.**

### 2026-10-15, #13682: rung 6 named the owner, and GitHub proved it faster than rung 7's poll
#13682 (WGSL sunk NaN table rebuilt per loop iteration) is gap G1 of slang-reviewer's #13669 R1 verdict (20:04Z), whose next-action was "slang-fixer documents G1 and files a follow-up". A 3-min poll of the fixer session that received the verdict (`gj2lyx`, on the #13635 thread) showed no filing report. But the issue's timeline had a `cross-referenced` event from #13669 (20:24:19Z), and the PR body's Risk line now cites #13682, next to the R2 commit `5b4f26a` (20:22Z) that applied the G2 test checks. So it was owned: I dispatched nothing and sent no report, because the #13669 Main gets the fixer's `[Fix Report]`. ⇒ **Before polling sessions, run `gh api repos/<o>/<r>/issues/<N>/timeline` and grep the parent PR body for `#<N>`: a cross-reference from a live bot PR settles ownership in one call.**

### 2026-10-15, #13683: the fixer's own push named the issue before its report landed
slang-fixer filed #13683 (`specializeStageSwitch` drops a callee shared with an unrooted export) at 21:46Z, on its #13631 thread, with slang-reviewer's agreement ("filing it separately is right", 21:39Z). A 5-min poll of the #13631 Main showed no `[Fix Report]` yet. The issue timeline then showed a `referenced` event (21:53Z): PR #13659's commit `c136bcb` cites #13683 in its implementation-comment note. So it was owned; I dispatched nothing, and the #13631 Main receives the Fix Report that lists it as unresolved. ⇒ **A `referenced` event (a commit, not a PR body) counts the same as #13682's `cross-referenced` one. Re-check the timeline after a poll times out, not only before it.**
