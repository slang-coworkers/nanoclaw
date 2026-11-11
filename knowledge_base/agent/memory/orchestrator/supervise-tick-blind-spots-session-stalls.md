---
type: runbook
description: /supervise-issues blind spots where the owning session stopped or lost an inbound (shapes 1–6, 12, 17, 19) — detector and nudge for each. Split from supervise-tick-blind-spots.md 2026-11-07.
---

# Scan blind spots: stalled or deaf owner sessions

Part of [[orchestrator/supervise-tick-blind-spots.md]] (hub, general detector `blind.py`). Shape numbers are stable
and cited elsewhere. Siblings: [[orchestrator/supervise-tick-blind-spots-dead-turns.md]],
[[orchestrator/supervise-tick-blind-spots-github-state.md]].

1. **Round-2 review request stalls in the reviewer, not the fixer** (tick 264; again tick 280, #11803 R2, reviewer
   `bokz3c` stopped 6.7 h). A `[Fix Review Request]` lands in a slang-reviewer session whose container stops without
   processing it; scan flags `awaiting_us` against the *fixer*. blind.py catches it. Nudge **slang-reviewer** pinned
   (acked < 1 min).
2. **Bot said "On it", then the owning container stopped** (tick 267, #12875: 9 h stall, fixer lost context). Bot spoke
   last → `awaiting_human`. Detector: owning session's newest row is an `in` webhook with no `out` after, PR head unmoved.
3. **Owning session is on a sub-thread or a non-chain thread** (tick 275). #13406 work ran on
   `gh-issue-shader-slang/slang-11709/13406-resume`, in neither chain's session set; jhelferty's split-PR ask sat 9 h
   while scan read `cost_stopped`/`awaiting_human`. Detector: for chains whose newest human comment is an instruction
   the bot acked, find the PR's `pr-mappings` row and grep `ncl sessions list` for `thread_id`s with `/` after the
   issue number.
   - Tick 282 (#13537): fixer `rt7qwx` sat on `gh-pr-shader-slang/slang-11344` (a takeover PR's old-PR thread —
     `ncl pr-mappings list` names it) and died 06:48Z mid-prototype. For every 🔼 row with a fresh human instruction,
     look up the PR's `pr-mappings` session and check its `.claude-trace` last `request.timestamp`. Pinned nudge →
     working in < 1 min.
   - Routine for R6-release work (tick 322): a release one-shot opens the PR from its own `system:tasks:<series>`
     session, so the PR owner is on no `gh-issue-` thread (#14209 → `fejlik`, #14210 → `5f63gx`, #14194 → `j9up0v`).
     For every fresh bot PR, read `ncl pr-mappings list` and check that session's `lastreq.py` before calling the
     chain idle. **Task sessions close when the task ends, and a closed mapped session swallows human webhooks**
     (they land as `in` rows and are never read): #14210 lost jkwak-work's 6-comment review for ~2 h (11-04 23:22Z →
     relayed 11-05 01:13Z). Check `ncl sessions get <mapped sid>`; `closed` → relay pinned to the chain session and
     request a remap.
4. **Reviewer acked with an ETA, then died silently** (tick 277, #13518: "verdict in ~45 min", sub-runs failed — A out
   of its $30 inner budget, C ECONNREFUSED — 11 h idle). Newest row is an `out`, so blind.py misses it. Detector: a
   stopped reviewer whose newest `out` promises an ETA older than ~2× that ETA; corroborate with the A/C run dirs
   `prod-groups/slang-reviewer/runs/{A,C}-<pr>-r<N>-<ts>/` (`exit-status`, `final-review.md` / `clarity-review.md`;
   older runs: `A-/B-/C-<pr>-r<N>.done`, `.done` = rc) under `/workspace/extra/ephemeral/`. Tick 289 (#13700 R4,
   `atuavs`): A finished 06:52Z, C died 07:57Z on `ECONNREFUSED`; pinned nudge got the verdict sent in 4 min.
5. **Fixer never processed the reviewer's verdict** (tick 278, #13571: inbound `[Review Verdict]` REQUEST_CHANGES at
   00:06Z, container stopped, head unmoved 12 h). blind.py catches it; check the PR head before nudging.
6. **Inbound lost to compaction while the container stays `running`** (tick 279, #13579). scan treats `running` as
   live. The triager's newest row was the 22:33Z relay, but its last model request was 22:02Z. Read
   `request.timestamp` across the last ~25 lines of `.claude-trace/session-<sid>.jsonl` — not the file mtime or the last
   `logged_at` (a long-lived SSE stream flushed later, 00:11Z). Nudged pinned; it acked "lost the relay when my context
   was compacted".
12. **Fixer waits on a CI-rerun webhook that never comes** (tick 302, #13876 / PR #13880). `test-falcor` failed; the
    fixer judged it infra, started a rerun and ended its turn saying "the webhook will report the result". Attempt 2
    failed 1 h later, but `ci_failed` did not fire again for the same check suite, so the fixer waited 9 h. Detector: a
    stopped fixer whose last turn text promises a rerun/webhook result; check `actions/runs/<id>` `run_attempt` +
    `attempts/<n>/jobs`, and compare the same job on other runs (merge-queue runs passing → not infra). Pinned nudge
    with the attempt-2 result.
17. **The operator's Continue is recorded but never takes** (tick 324, #13685 fixer `yiuh5a`). The dashboard Continue at
    11-03 11:24Z (and a second `cost_override` row at 18:11Z) set ledger episode `cst-ioav1ri` to `continued`, but
    `ncl cost-cap status --session` still read `stopped` with the old $300 ceiling, and the trace had no model request
    since 10-30 04:00Z. The same press on `yofko5` did take (ceiling → $496.77). Detector: for every row of
    `ncl cost-cap stopped`, read `ncl cost-cap escalations --group <folder>`; a `continued` episode on a session that
    is still `stopped` means the Continue failed. Board it as an operator call (`set-ceiling` or a session restart);
    don't press it again from here.
19. **A relay or webhook that never lands** (tick 330, 11-06 22:48–23:01Z). scan reads Main's `out` relay as "us acted",
    but the target never received it. Two Main sessions relayed maintainer/reporter input to a **stopped** triager
    session on the canonical thread (#14036 `acyb6s`, #14057 `axf4gg`): no `in` row appeared and no session was
    minted. A reporter comment on #14048 arrived 4 s after the mapped fixer's [Report] and never reached it (end-of-turn
    race); #14194's pr-mapping pointed at a **closed** one-shot task session, so its webhook was dropped. Detectors:
    `tickNNN/relaycheck.py` (each Main `out` relay since the last tick carrying a comment id → is that id in an `in`
    row of a triager/fixer/reviewer on the same thread?) and `tickNNN/deliv.py comments-since.txt <since>` (each human
    comment from the repo-wide `issues/comments?since=` feed → is its id in the mapped/thread session?). Ignore hits
    whose only carrier is your own re-delivery. Fix: re-send the original relay text verbatim, pinned
    (`target_session_id` + `in_reply_to=<the cron session's task row>`); all 3 landed in ≤ 1 min, acted on in ≤ 3 min.
    A closed-session pr-mapping does not always need an operator `ncl pr-mappings remap`. On 11-10 the live owner's
    `report_pr_created` re-claimed #14209's mapping from the closed `fejlik` (Main-verified). First route the work
    to the live owner. Ask for a remap only if the mapping still points at the closed session after the owner reports again.
