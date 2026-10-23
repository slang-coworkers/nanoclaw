---
type: chain
title: slang#13298 — GCP-T4 Windows runner dies mid-test in release-gpu-dx (merge_group, 14m01s)
description: CLOSED 2026-10-22 by jkiviluoto-nv (completed). Cause was commit-limit exhaustion from the 1 GiB pagefile; fixed by a 32 GiB pagefile image on 09-29. 0 recurrences in ~147 post-fix merge_group jobs. Nothing posted from our side.
---

# slang#13298 (filed by jkwak-work, 2026-09-28)

**Terminal: closed 2026-10-22T12:05Z by jkiviluoto-nv: "Closing, seems like pagefile adaption helped."**

## What it was
- `test-windows-release-cl-x86_64-gpu-dx / test-slang` on `[Windows, self-hosted, GCP-T4]` lost its
  runner at a constant 14m01s (≈840 s). It happened only in `merge_group` runs, and no log was ever uploaded.
- Maintainer GCP check (09-29): the guest rebooted mid-test. Repro: a 1 GiB pagefile pushed commit to
  99.98% of the limit, Windows logged event 2004 naming `test-server.exe`, and the VM bugchecked
  (0x7E in `dxgmms2.sys`). A 32 GiB pagefile ran 20/20 clean.
- Fix: image `windows-gpu-runner-pagefile32-candidate-20260929`, made current in the
  `windows-gpu-runner` family at about 2026-09-29T12:13:50Z.

## Who did what
- slang-ci-babysitter independently confirmed the 8 occurrences on 09-28 and keeps a requeue fingerprint
  memo. It has no write access to the repo.
- Orchestrator re-chases counted merge_group jobs after the rollout:
  - 0/100 runner-loss by 10-16.
  - 0/32 for 10-16 → 10-21, all success at 309–354 s.
  - Then #13813 (merged 10-21 12:44Z) folded the -dx/-vk/-cuda jobs back into
    `test-windows-release-cl-x86_64-gpu / test-slang`. That job shows 0 runner-loss in its first
    15 completed runs. Its one failure, job 119617930432 on 10-22 (exit code 1, 746 s), is a real
    test failure, not a runner loss.
- The operator never answered the three standing decisions (asked 10-08, 10-12, 10-16): posting the
  verification, slang-triager taking the 19 always-failing repro tests, and retiring the watch. With
  the issue closed, the first and third no longer matter.

## Durable lessons
- The fingerprint only holds while the job name does: after #13813 the job is
  `test-windows-release-cl-x86_64-gpu / test-slang`. Any count by job name must follow renames.
- GitHub's jobs API 502s on bulk loops. Tag every output row with its run id and retry, or one
  error body looks like a job row.
- A 14m01s runner loss on the merged job now would be a regression of the pagefile fix, not the
  old flake. The maintainer pointed at the graphics stack (`dxgmms2.sys`) for that case.
