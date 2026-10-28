---
type: runbook
description: Real stalls that /supervise-issues scan.py misreads as awaiting_human / running / cost_stopped — each with the detector that catches it and how to nudge. Split from the tick runbook 2026-10-13.
---

# /supervise-issues scan blind spots (real stalls scan misses)

scan.py classifies by who spoke last on GitHub and by session status. These shapes defeat both; check for them every
tick after the scan. Procedure: [[orchestrator/supervise-tick-runbook.md]]. The inverse list (flags that aren't real):
[[orchestrator/supervise-tick-false-positives.md]].

**General detector:** `tickNNN/blind.py` — sort rows by **timestamp** (`--reverse` order is by seq and unreliable), read
20, flag sessions whose newest row is an unanswered `in` with the container not running. Always nudge with
`target_session_id` pinned and confirm the `in` landed. Its top hits are mostly "Learning saved" system acks (5 of 6 at
tick 289) — skip those.

1. **Round-2 review request stalls in the reviewer, not the fixer** (tick 264). A `[Fix Review Request]` lands in a
   slang-reviewer session whose container stops without processing it; scan flags `awaiting_us` against the *fixer*.
   Nudge **slang-reviewer** pinned.
2. **Bot said "On it", then the owning container stopped** (tick 267, #12875: 9 h stall, fixer lost context). Bot spoke
   last → `awaiting_human`. Detector: owning session's newest row is an `in` webhook with no `out` after, PR head unmoved.
3. **Owning session is on a sub-thread** (tick 275). #13406 work ran on `gh-issue-shader-slang/slang-11709/13406-resume`,
   in neither chain's session set; jhelferty's split-PR ask sat 9 h while scan read `cost_stopped`/`awaiting_human`.
   Detector: for chains whose newest human comment is an instruction the bot acked, find the PR's `pr-mappings` row and
   grep `ncl sessions list` for `thread_id`s with `/` after the issue number.
4. **Reviewer acked with an ETA, then died silently** (tick 277, #13518: "verdict in ~45 min", sub-runs failed —
   A out of its $30 inner budget, C ECONNREFUSED — 11 h idle). Newest row is an `out`, so blind.py misses it. Detector:
   a stopped reviewer whose newest `out` promises an ETA older than ~2× that ETA; corroborate with
   `A-/B-/C-<pr>-r<N>.done` (`.done` = rc) in `/workspace/extra/ephemeral/prod-groups/slang-reviewer/`.
5. **Fixer never processed the reviewer's verdict** (tick 278, #13571: inbound `[Review Verdict]` REQUEST_CHANGES at
   00:06Z, container stopped, head unmoved 12 h). blind.py catches it; check the PR head before nudging.
6. **Inbound lost to compaction while the container stays `running`** (tick 279, #13579). scan treats `running` as live.
   The triager's newest row was the 22:33Z relay, but its last model request was 22:02Z. Read `request.timestamp`
   across the last ~25 lines of `.claude-trace/session-<sid>.jsonl` — not the file mtime or the last `logged_at`, which
   was a long-lived SSE stream flushed later (00:11Z). Nudged pinned; it acked "lost the relay when my context was
   compacted".

Shape 3 recurred at tick 282 (#13537): owning fixer `rt7qwx` sits on `gh-pr-shader-slang/slang-11344` (a takeover PR's
old-PR thread — `ncl pr-mappings list` names it), died 06:48Z mid-prototype after promising a #13537 report; scan read
`awaiting_human` and blind.py only saw the chain's own sessions. For every 🔼 row with a fresh human instruction, look up
the PR's `pr-mappings` session and check its `.claude-trace` last `request.timestamp`. Pinned nudge → working in <1 min.

Shape 1 recurred at tick 280 (#11803 R2 request, reviewer `bokz3c` stopped 6.7 h); blind.py caught it and the
pinned nudge acked in under a minute.

7. **Approved + auto-merge armed, but the PR is `DIRTY`** (tick 283, #13537). A maintainer approves and enables
   auto-merge, then master moves and the branch conflicts; auto-merge silently never fires. scan reads `awaiting_us`
   as "human spoke last" and `ci.py` shows ✅ (DIRTY isn't BEHIND, so no rebase-nudge cell). Detector: for every
   open PR with `autoMergeRequest != null`, check `mergeStateStatus == DIRTY`. Nudge the `pr-mappings` owner pinned
   to merge master (merge commit, keep the approver's commits). Fixer acked in 2 min. Sweep, since `gh pr list` GraphQL
   502s often: `gh api 'repos/<o>/<r>/pulls?state=open&per_page=100&page=N' --jq '.[]|select(.auto_merge!=null)|.number'`,
   then `pulls/<n>` → `mergeable_state` (`dirty`/`behind`). Tick 283's first sweep found 2 more bot PRs: #13171
   (behind 66, its only CI run yielded at the priority gate 2 days earlier and was never retried) and #12820 (approved
   09-03, dirty, 281 behind) — both invisible to scan for weeks.

8. **Approved bot PR evicted from the merge queue** (tick 284, #13171). After the shape-7 fix the maintainer
   queued it, and the merge-group CI lost 3 Windows debug GPU runners ("runner lost communication", infra). The
   queue removed it, which also drops auto-merge. The PR is now `BLOCKED` with green PR CI and no `auto_merge`,
   so the shape-7 sweep no longer sees it either. The babysitter reports evictions to the dashboard, but the bot
   can't re-enqueue, so the PR waits silently for a human. Detector: for each open approved bot PR, read
   `issues/<n>/timeline` for a trailing `removed_from_merge_queue` with no later `added_to_merge_queue`. This
   needs no nudge to a coworker; it goes on the board as an operator call (requeue, or ask the approver).
9. **Open bot draft whose target issue closed under it** (tick 297: #13650 after #13644 merged, #13699 after
   jkwak-work's #13715 closed #13446). Closed chains drop out of scan, so the stale draft is invisible on the board
   and nobody owns closing it. Detector: one GraphQL `search(is:pr is:open author:app/nv-slang-bot)` with
   `closingIssuesReferences{number state closedAt}`; any row whose every closing ref is CLOSED goes on the board as an
   operator call (close with a pointer to the superseding PR). Tick 297 also found #13079 and #13154 (all refs closed) and #13741 (one closed ref, plus the open #10522).

10. **Fleet restart killed a coworker mid-tool-call** (tick 298, 00:20Z). Containers that were `running` show `stopped`
    with no `out` after their last inbound, so scan reads `awaiting_human`. blind.py misses it because the newest row
    is the coworker's own progress `out`. Detector: for every `.claude-trace/session-*.jsonl` modified since the fire,
    parse the last request's `body_raw` SSE `message_delta.stop_reason`; a **`tool_use`** stop on a now-`stopped`
    container means the turn was killed (an `end_turn` stop means it finished). Tick 298 found #13632 (fix done, PR not
    opened for jkwak-work's ask) and rhi#911 (GitHub post landed, report not sent). Pinned nudges had both running in <8 min.
    The supervisor's own tick can die the same way: resume from the `tickNNN/` artifacts, don't restart the pull.

11. **Gateway key budget hit killed a turn** (tick 299, #13828). For 22 s (10-22 07:42:25–47Z) every model call got HTTP 422
    `budget_exceeded`: LiteLLM key `slang_coworkers-prod-svc_slang_dev` was at $32.7k against a $25k max. The agent SDK
    retried 5× across models, then the turn ended. Shape 10's detector misses this, because the last trace line has no
    `stop_reason`. Scan read "fixer owns this chain, no PR, silent". Detector: grep traces modified since the fire for
    `"status_code": 422` with `budget` in the body. Sessions with no later 200 are dead (`tick299/budget.py`). Pinned
    nudge → resumed in 3 min. Escalate the key budget to the operator, because a longer window stalls the whole fleet.

12. **Fixer waits on a CI-rerun webhook that never comes** (tick 302, #13876 / PR #13880). `test-falcor` failed; the fixer
    judged it infra (public-Falcor compile showed no diff), started a rerun and ended its turn saying "the webhook will
    report the result". The rerun (attempt 2) failed 1 h later, but `ci_failed` did not fire again for the same check
    suite, so the fixer waited 9 h. Detector: a stopped fixer whose last turn text promises a rerun/webhook result;
    check `actions/runs/<id>` `run_attempt` + `attempts/<n>/jobs`, and compare the same job on other runs (merge-queue
    runs passing → not infra). Pinned nudge with the attempt-2 result.

13. **Turn died on a context overflow, and the session had stopped since the last tick** (tick 309, #13828 / draft #13867).
    The triager's 23:29Z "merge master" ask reached fixer `4stbs2`. Every main-thread call returned HTTP 400
    (598–682 messages, 4.5–7 MB per request; the gzip body in `.claude-trace` can't be decoded). The turn ended with no `out`.
    blind.py missed it, because the session was `running` at the previous re-list and its `last_active` never moved. Detector:
    `tickNNN/runstop.py`, which flags open-chain sessions that went `running` → stopped since the previous `sessions2.json`
    (copy that file to `prev-sessions2.json`). Check the trace for runs of 400s with message counts in the hundreds.
    A pinned nudge recovered it: after about 4 min of 400s it compacted (~280 messages) and acked. **Wait at least 5 min
    after a nudge before calling a session wedged.** Tick 309 posted a reset request and then had to send a correction.

Shape 4 recurred at tick 289 (#13700 R4): reviewer `atuavs` said at 06:24Z that its final verdict was waiting on A and C. A
finished at 06:52Z, and C died at 07:57Z on `ECONNREFUSED`. The reviewer's last model request was at 07:53Z. The A/C run dirs are
`prod-groups/slang-reviewer/runs/{A,C}-<pr>-r<N>-<ts>/` (`exit-status`, `final-review.md` / `clarity-review.md`). A pinned
nudge got the verdict sent in 4 min.

Typical outcome: every pinned nudge above acked within 1–3 min.
