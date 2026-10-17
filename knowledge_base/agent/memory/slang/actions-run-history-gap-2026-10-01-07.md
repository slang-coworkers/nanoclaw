---
type: incident
title: shader-slang/slang Actions run history missing for 2026-10-01 20:05Z to 2026-10-07 21:49Z
description: The Actions API returns zero workflow runs for about 6 days, and known run ids from that window return 404. Cause unknown (deleted or purged). PRs whose head was pushed in that window have no check-ci and look like they "never ran CI".
tags: [slang, ci, github-actions, infra, open-question]
---

# Actions run history gap (10-01 → 10-07)

**Checked live 2026-10-12 ~20:30Z:**
- `GET /actions/runs?created=…` returns 0 for each day 10-02 through 10-06. It also returns 0 for 10-01 20:05Z–23:59Z and for 10-07 00:00Z–21:49Z. The adjacent days have normal volume (09-30: 1528, 10-01: 1065, 10-07 after 21:49Z: ~615 runs).
- Last run before the gap: 36918962462 (10-01 20:04:51Z). First after it: 10-07 21:49:28Z.
- Run 37398367468, which I recorded on 10-05 in the #13436 chain, now returns 404. So runs existed and were removed. It is not that nothing ran.
- Merge commits from the window have 0 check-runs: `e6be8dcdd7` (#12935, 10-05) and `eaf758404f` (#13432, 10-07). For comparison, `f7e14a1a62` (10-12) has 424.
- Check-runs are gone too, not only run records. So PRs whose head is in the window show no `check-ci`, and the babysitter now tracks them as `no-ci`/`ci-vanished`. It counts 13 such open PRs.

**Cause: unknown.** It could be a bulk run deletion, or a retention or purge action by a repo admin or GitHub. The babysitter gets 403 on the retention-settings API. It doesn't affect merged code, only the CI evidence for those commits.

**Consequence:** those PRs won't recover on their own. Each needs a push, a master merge, or a re-dispatch to get a `check-ci` again. Don't read their `no-ci` as "a maintainer never approved the run."

**Open:** asked the operator 2026-10-12 whether the history was deliberately deleted.

## 2026-10-13 06:33Z: the gap is growing (re-measured live)

- 10-07 previously had ~615 runs after 21:49Z. Now only **11** remain, created between 20:16Z and 21:45Z.
- 10-08 00–03Z has 1 run, and 04Z and 05Z have 0. Runs resume at **10-08 06:37Z**: 33 in the 06Z hour, 125 in the 07Z hour.
- Run 37704498417 (10-07 23:50Z), which I listed yesterday, now returns 404. Run 37746639315 (10-08 07:57Z) still exists.
- Days outside the gap are intact: 09-30 has 1528 runs, 10-01 has 1065, and 10-08 after 21:55Z has 1893.
- **So the deletion is still happening, and it moves forward in time.** The front was at 10-07 21:49Z on 10-12 ~20:30Z and at 10-08 06:37Z on 10-13 06:33Z, so about 9h of history went in 10h. Runs before 10-01 20:05Z are untouched. It runs ~5 days behind real time.
- It isn't specific to fork PRs. The babysitter's "ci-vanished wave" (#13303, #13504, #13451, #13476) is just PR heads whose runs fall inside the moving window. For example, #13504's head was committed 10-07 22:58Z and survived yesterday, but is gone today.
- **Workflow runs don't expire through retention; the retention setting only expires logs and artifacts. So this is almost certainly someone or something calling the delete-run API in order.** That's inference. I re-raised it with the operator 10-13 as urgent, with the front position.

## 2026-10-13 10:23Z: the deletion picks which runs to delete (re-measured live)

- Hourly run counts for 10-08: 06Z 0, 07Z 1, 08Z 4, 09Z 5, 10Z 17, 11Z 309, 12Z 127.
- The runs that survive inside the deleted range are almost all bookkeeping runs: CI Health, CI Retry Yielded Bot, PR Checks Complete Sync, Check IR Version, Issue Onboard and Populate sccache. A few `pull_request` CI and label/format runs survive too. So most PR-triggered CI runs are being removed, but not every run, and the front is ragged rather than a clean cutoff.
- The front advanced from ~06:37Z to ~10:xxZ (10-08) between 06:33Z and 10:23Z today, about 4h of history in 3h50m. That's the same pace as before.
- No answer from the operator yet. The audit-log check (`workflows.delete_workflow_run`) is still the open step.
- 10-13 14:16Z: the front is at ~10-08 14Z (12Z has 0 runs, 13Z has 2, 14Z has 249). That's ~3.5h of history since 10:23Z, still about 1h of history per hour. The babysitter said the front was "faster"; it was comparing ragged front positions. No operator answer yet.

## 2026-10-15 00:08Z: the front has stopped (re-measured live)

- The hourly counts for 10-09 14Z/15Z/16Z are 38/47/167, the same as the babysitter's 10-14 16:00Z and 20:00Z samples. Dense history resumes at 10-09 16:01:40Z, so the front hasn't moved for about 8h. Before that it advanced about 1h of history per hour for 2 days. It now sits about 5d8h behind real time.
- Whether it stopped for good or is paused is unknown. A stop is consistent with someone ending a deletion job. Total deleted span: 10-01 20:05Z to 10-09 ~16Z.
- #13151 and #13181 (heads 10-09 ~07Z) flipped to `ci-vanished` before the stop.
- Still no operator answer on whether it was deliberate.

## 2026-10-16 22:08Z: deletion resumed (re-measured live)

- 10-09 hourly counts are now 12Z 0, 14Z 0, 16Z 0, 18Z 1, 20Z 0, 22Z 0, 23Z 4, and 10-10 00Z 75. Before this, 14Z/15Z/16Z were 38/47/167 and had been flat from 10-14 16Z until at least 10-16 ~10Z. So the deletion **paused for roughly 1.5–2 days, then resumed**, and the front is now around 10-10 00Z. Deleted span so far: 10-01 20:05Z → about 10-10 00Z.
- The pause and restart rule out a one-off cleanup that ran to completion. Something deletes in batches, oldest first, and can pause. The pause roughly overlaps the 10-16 00:16Z hard reboot of prod. That overlap is my inference and isn't confirmed.
- New victim: #12656 (head committed 10-09 14:58Z). It showed `check-ci` SUCCESS on 10-15 and now has 0 check-runs.
- I've re-raised it with the operator because it's moving again. The audit-log check is still the open step.
