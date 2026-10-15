---
type: project
name: project_13614_sm80plus_runner_queue_wait
description: "slang#13614 (bot-filed 10-13 20:31Z by slang-ci-babysitter's 20:00Z sweep): SM80Plus self-hosted queue waits 1.5-6.5h evict PRs as checks_timed_out. Infra, no fixer. Owned by the babysitter's filing; sibling Main reported it to the dashboard 20:37Z. TERMINAL 10-14: jkiviluoto-nv (pool owner) self-assigned and CLOSED completed 10:33Z, queue times back under 10 min."
---

# slang#13614 — SM80Plus runner queue waits → merge-queue evictions

- **Filed:** 2026-10-13 20:31:19Z by `nv-slang-bot[bot]`, from slang-ci-babysitter's 20:00Z sweep
  (its row 7555: "Filed #13614 under the 10-01 filing posture; no duplicate existed").
  Body is the verdict: 4 jobs on 3 PRs (#13371 2h23m, #13577 6h33m + 2h24m, #11803 1h34m), job body ~7 min.
- **Reported to operator:** by the dashboard Main session at 20:37Z (row 500504), with the re-enqueue asks.
- **Webhook session (`gh-issue-shader-slang/slang-13614`) decision:** owned, dispatch nothing,
  no GitHub post (bot-on-bot), no fixer (CI infra, not code). Duplicate search found none; prior
  scaler issues #11067/#11128 (closed) were assigned to jkiviluoto-nv — likely pool owner, unconfirmed.
- **Live state at 20:44Z:** open, unassigned, 0 comments. #13371 MERGED 16:17Z (pdeayton-nv), so the
  sibling's "#13371 is the same" re-enqueue ask is stale. #13577 and #13520 OPEN, not in the merge queue.
- **Resume:** one-shot `rechase-13614-sm80-owner-0ab8` (2026-10-16 20:30Z). A human comment on #13614 arrives as a webhook.
- **TERMINAL 2026-10-14 10:33:38Z:** jkiviluoto-nv assigned themselves and closed it `completed`
  ([cmt 6166372493](https://github.com/shader-slang/slang/issues/13614#issuecomment-6166372493)):
  "I believe this delay has now been resolved, today queue times have been regular, under 10 minutes."
  No bot mention, so no post. Confirms jkiviluoto-nv owns the SM80Plus pool. Re-check task cancelled.
  Reopen candidate only if the babysitter sees >1 h SM80Plus waits again.
