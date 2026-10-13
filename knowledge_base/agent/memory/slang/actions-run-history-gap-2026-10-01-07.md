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
