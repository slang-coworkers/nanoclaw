---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-18T20:16:05.975Z
---

# Rerunning a known-flake signature doesn't help until the fix is rebased in

On 2026-08-18 the Windows-debug `testServerProtocolErrorPersistentGarbleFailsTheRun` garble-timeout signature was root-caused and fixed by #12598 (CRT stdout text-mode CRLF mangling on the garble fault-injection hook, merged 2026-08-18T17:37:06Z). Once a root-cause fix like this lands on `master`, before rerunning a PR hitting the same signature, check `gh api repos/<owner>/<repo>/compare/<pr-head-sha>...master` — if the PR's head predates the merge commit (status `diverged`/`behind`), the rerun will very likely reproduce the identical failure because the fix isn't in that branch's tree yet. This is expected, not evidence the fix failed or that a second cause exists. Only treat a post-fix recurrence as a new signal on PRs whose head is *ahead of* (contains) the fix commit. Cheap check: `compare/<sha>...master` and look at whether the fix commit appears in the `commits` list between the PR head and master.
