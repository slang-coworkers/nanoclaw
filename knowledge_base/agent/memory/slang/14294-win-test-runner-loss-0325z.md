---
type: project
title: slang#14294 — win-test-* (GCP-T4) runners lost at ~03:25Z / ~03:42Z UTC
description: "Bot-filed CI-infra issue 11-04 04:28Z. 12 Windows GPU runner losses on 7 days, all ending 03:25–03:44Z; mid-test, no log. Infra, no triager/fixer, no bot post. Owner: GCP-T4 pool owner (jkiviluoto-nv did the #13298 pagefile fix). Recheck 11-05 04:05Z: no recurrence; assigned jkwak-work + jkiviluoto-nv, milestone Q1 2027."
tags: [ci-infra, gcp-t4, windows-gpu, merge-queue]
---

# slang#14294 — Windows GPU runners lost at a fixed time of day

- **Filed:** 2026-11-04 04:28:39Z by `nv-slang-bot[bot]`, no labels — filed by **slang-ci-babysitter**
  (per the sibling Main session's dashboard row seq 510698, 04:30:59Z, which already alerted the operator:
  "Nothing to decide; the runner owners should see it").
- **Claim:** `[Windows, self-hosted, GCP-T4]` `win-test-*` runners lose contact only in 03:25–03:28Z
  and 03:41–03:44Z (10-15, 10-16, 10-20, 10-23, 10-28, 11-03, 11-04). Annotation "The self-hosted
  runner lost communication with the server"; log `BlobNotFound`. Caused `failed_checks` queue
  removals of #13171, #13684, #14111. Other self-hosted pools in the window were not hit.
- **Verified by me 04:31Z** (Actions API): job 126343139514 (`win-test-ae8a4150`, 02:16:10→03:26:20Z,
  failure, the lost-communication annotation) and job 125692432093 (`win-test-16309986`,
  02:49:22→03:42:39Z, failure). Matches the issue table.
- **Not #13298** (closed 10-22): that was release-dx at a constant 14m01s, fixed by the 32 GiB pagefile.
  See [13298-gcp-t4-runner-loss-pagefile.md](13298-gcp-t4-runner-loss-pagefile.md).
- **Decision (webhook session `gh-issue-shader-slang/slang-14294`):** same as
  [#14252](14252-sm80plus-runners-stalled.md): CI infra, no triager/fixer, no GitHub post (bot-on-bot).
  Operator already told by the sibling session (seq 510698); this session posted nothing more (dedupe rule). Only someone with GCP scale-set / host access
  can see what runs at 03:25Z (runner-list API is 403 for the bot).
- **Resume:** one-shot `recheck-14294-win-test-l-d37f` at 2026-11-05T04:05Z counts win-test jobs in that
  morning's window. A human comment or close arrives as a webhook.
- **Recheck 2026-11-05 04:05Z (`recheck-14294-win-test-l-d37f`): no recurrence.** Issue OPEN, 0 comments.
  On 11-04 17:33Z `jkwak-work` assigned `jkwak-work` + `jkiviluoto-nv` and set milestone "Q1 2027 (Winter)".
  This is human triage, not a reply, so no dashboard post (the task allowed one only for a recurrence, a reply, or a close).
  Actions API, CI runs created 11-04 22:00Z–11-05 03:55Z (12 merge_group + 22 pull_request): 48 win-test jobs,
  **all success**. 4 overlapped 03:15–03:55Z, all in run 41957880821: 127021203339 (`win-test-324c01ce`
  03:08:47→03:22:19), 127021203382 (`win-test-dd487ca1` 03:08:27→03:16:08), **127023097757 (`win-test-376e78d4`
  03:13:49→04:03:54, ran through both the 03:25 and 03:42 windows)**, 127023097806 (`win-test-ddb54708`
  03:13:42→03:41:31). No lost-communication annotation. So the loss does not happen every day (one clean
  day, consistent with the issue's 7-of-~21-day pattern). No further timer; a human comment or close arrives as a webhook.
- **11-05 11:36Z dashboard asked for a triage verdict.** I answered directly on this thread and did not dispatch
  slang-triager: it is CI infra, and humans already own it (assigned 11-04 17:33Z, rung 4). Verdict: CI infra,
  GCP-T4 Windows GPU pool, P2 (intermittent merge-queue evictions, workaround is re-enqueue). Next step is with
  jkiviluoto-nv: what runs on the hosts or the scale set at ~03:25Z and ~03:42Z.
