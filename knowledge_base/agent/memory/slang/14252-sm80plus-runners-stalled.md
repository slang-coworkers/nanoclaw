---
type: project
title: slang#14252 — SM80Plus self-hosted runners stalled since 17:43Z 11-03
description: "Bot-filed CI-infra issue 11-03 20:06Z. SM80Plus pool stalled 17:43→20:11Z, briefly recovered (3 jobs 20:11–20:18Z), re-stalled from ~20:19Z; #14111 merged 21:05Z, #14204 dequeued by jkwak-work 21:42Z. Infra, no fixer, no bot post. Pool owner jkiviluoto-nv (#13614). Operator ping recommended 21:5xZ."
tags: [ci-infra, sm80plus, merge-queue]
---

# slang#14252 — SM80Plus runners not picking up jobs

- **Filed:** 2026-11-03 20:06:52Z by `nv-slang-bot[bot]`, label `CI Stability`. The filing session
  was not found in the recent Main or babysitter sessions (grep for 14252/SM80); it is bot-filed either way.
- **Decision (webhook session `gh-issue-shader-slang/slang-14252`):** same as
  [#13614](../imported/project_13614_sm80plus_runner_queue_wait.md): CI infra, no triager/fixer, no
  GitHub post (bot-on-bot). Reported to the operator on `orchestrator-dashboard`.
- **Verified 20:09Z:** jobs 126107962339 (#14204) and 126104095904 (#14243) still `queued`, `runner_name`
  empty. pdeayton-nv re-enqueued #14111 at 19:41:55Z; its merge-group run 41705721362 has the sm80
  job (and two `GCP-T4` Windows jobs) queued, so expect a 4th `checks_timed_out` eviction ~21:40Z if
  the pool stays down. #14111's queue history 11-03: 02:22→03:43 (Windows GPU runner lost),
  08:17→10:18 (sm80 wait), 17:37→19:40 (sm80 wait), 19:41 re-added.
- **Owner of the fix:** the SM80Plus pool owner, jkiviluoto-nv per #13614 (closed it 10-14). The
  runner-list API is 403 for the bot, so only a human can see whether the runners are offline.
- **Resume:** one-shot `recheck-14252-sm80-runne-480b` (2026-11-03 21:50Z). A human comment or close
  on #14252 arrives as a webhook.
- **Re-check 21:53Z (`recheck-14252-sm80-runne-480b`):** #14252 still OPEN, no comments/assignee.
  The pool **recovered briefly**: jobs 126104095904 (#14243, runner `linux-sm80plus-963a5357`, start 20:11:18Z),
  126107962339 (#14204, `linux-sm80plus-5dac3e4e`, 20:12:51Z) and 126171933725 (#14111 merge group,
  `linux-sm80plus-1b7d1ae5`, 20:18:50Z) all succeeded. #14111 **merged 21:05:19Z** (no 4th eviction).
  Then it **re-stalled**: no SM80Plus start after 20:18:50Z; #14204's merge-group run 41711939225
  (enqueued 20:21:58Z) has sm80 job 126195842508 queued with no runner since 20:48:29Z, every other job
  green. jkwak-work removed #14204 from the queue at 21:42:36Z (manual, not `checks_timed_out`).
  Reported to `orchestrator-dashboard` (thread `gh-issue-shader-slang/slang-14252`), with a recommendation
  that the operator ping jkiviluoto-nv. No GitHub post. No further timer: a human comment/close on #14252
  arrives as a webhook, and the babysitter sweep sees re-enqueues.
