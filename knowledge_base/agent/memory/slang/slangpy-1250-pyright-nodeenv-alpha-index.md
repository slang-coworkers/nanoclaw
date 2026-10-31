---
type: chain
title: slangpy#1250 — pyright step red in every ci-latest-slang run (nodeenv vs nodejs v27.0.0-alpha index entry)
description: CLOSED 2026-10-30 13:49Z via maintainer PR #1253 (`pyright[nodejs]`, jkwak-work); bot PR #1251 (nodeenv floor) closed unmerged. Bot-filed (nv-slang-bot) 2026-10-30 00:02Z. "SlangPy Tests" check red on every Slang PR since 10-29 ~22:15Z; not PR-caused. Triaged P1 (env regression) 10-30 00:13Z; fix A `pyright[nodejs]` handed to slangpy-fixer. Needs a MERGE to main to clear Slang PRs.
tags: [slangpy, ci, infra, pyright, nodeenv]
resource: raw/slangpy-1250-triage-memo.md
---

# slangpy#1250 — pyright / nodeenv CI break

- **Filed** 2026-10-30 00:02Z by nv-slang-bot[bot]; no labels, no comments at dispatch. No R6 hold (bot-filed).
- **Verified by me 10-30**: `https://nodejs.org/dist/index.json` first entry is `v27.0.0-alpha.0.0.0`
  (2026-10-29), then `v26.13.0`. `tools/ci.py` `typing_check_python` runs bare `pyright`
  (pyright 1.1.411 + nodeenv 1.10.0 per the issue), which bootstraps node through nodeenv.
- **Effect on slang chains:** a red "SlangPy Tests" check on any Slang PR from 10-29 22:13Z on is this
  infra break, not the PR — don't dispatch a fixer to chase it.
- **Owner:** slangpy-triager on thread `gh-issue-shader-slang/slangpy-1250` (no prior owner existed;
  only Main's webhook session was on the thread).
- **10-30 00:05Z triager progress:** pyright runs at three sites, all candidate fix sites:
  `ci.yml:210`, `ci-gcp.yml:158`, `build-and-test-with-slang/action.yml:134`. The triager is now
  checking slangpy's own CI runs and reproducing the failure locally.
- **10-30 00:06Z triager root cause (its finding, not yet verified by me):** with no node on the runner,
  pyright falls back to nodeenv 1.10.0. nodeenv takes the first index.json entry with no
  prerelease filter, and `parse_version` crashes on int('0-alpha'). The triager is now reproducing
  the failure end-to-end and testing the candidate fixes.
- **10-30 00:08Z triager repro (its finding):** reproduced locally with nodeenv 1.10.0 and no global node.
  Three fixes each gave a clean pyright run in scratch venvs: `pyright[nodejs]`, `nodeenv>=1.11.1`
  (released 10-29 20:54Z; picks 26.13.0), and `PYRIGHT_PYTHON_NODE_VERSION=lts`. The triager is now
  checking why the runners resolve nodeenv 1.10.0.
- **10-30 00:13Z triage report:** P1 regression caused by the environment, not code (`requirements-dev.txt`).
  The self-hosted `nvrgfx-kernelvm-bridge` runners have no node, and their persistent
  `_work/_tool/Python` toolcache keeps nodeenv 1.10.0 because pip reports "already satisfied".
  nodeenv 1.11.1 fixes the crash. **Verified by me:** 1.11.1 was uploaded to PyPI 10-29 20:54:02Z,
  and slangpy's own `ci.yml` run 40960250198 (21:44Z, a PR) failed only on
  `build (windows, x86_64, msvc, Release, 3.10)`.
  The GitHub-hosted ubuntu and macOS jobs are unaffected because they have a global node.
  Recommended fix **A**: `pyright` → `pyright[nodejs]` in `requirements-dev.txt:7`.
  Alternatives: B `nodeenv>=1.11.1`, C `PYRIGHT_PYTHON_NODE_VERSION=lts`, D setup-node.
  The triager handed fix A to slangpy-fixer on this thread. Its full memo is in [raw/](raw/slangpy-1250-triage-memo.md).
- ⚠️ `ci-latest-slang.yml` checks out slangpy's **default branch**, so "SlangPy Tests" on Slang PRs
  stays red until the fix merges to main, and the failed checks must then be rerun. A draft PR does not help.
- 10-30: the issue had **no triage comment** when the report arrived, so I asked the triager to post one; it posted at 00:14Z as [comment 6511626221](https://github.com/shader-slang/slangpy/issues/1250#issuecomment-6511626221)
  (bot-filed, no R6 hold). I also gave the operator a heads-up that a fast merge is needed.
- Lesson: my "no comment" check raced the triager's post, which landed 00:13:36Z, seconds after its report.
  The triager edited the comment in place, so there is no duplicate. Re-check the issue right before asking a coworker to post.
- **10-30 00:20Z fixer:** the fix is committed as `19389c9e` (`requirements-dev.txt` +3), verified before and after on a
  simulated cached runner, with PLAN and CODE critique approved. The fixer is opening a **draft** PR. The operator was asked
  (00:13Z) to line up a fast maintainer review and merge. The PR link goes to the dashboard when it opens.
- **10-30 00:24Z PR [slangpy#1251](https://github.com/shader-slang/slangpy/pull/1251)** (draft, `fix/issue-1250`, head `19389c9e89`).
  It adds `requirements-dev.txt` +3 = **approach B, `nodeenv >= 1.11.1`**, not the recommended A. The triager verified B
  on a simulated cached runner. I had told the dashboard "A" at 00:13Z and corrected it at 00:24Z. CI was queued when
  the PR opened. Next: a maintainer flips it to ready and merges, then the failed Slang PR "SlangPy Tests" checks are rerun.
- **10-30 00:32Z fixer [Report]:** #1251 is a draft, with kaizhangNV auto-assigned as shepherd by board-sync. ci.yml run
  40979519583 and the slangpy-reviewer verdict are pending. Explanation comment 6511811465, issue status comment
  6511820718. The report said B was "your choice", but **I never chose between A and B**, so I corrected the fixer.
  The PR body lists only the `PYRIGHT_PYTHON_NODE_VERSION` alternative, not the triager's recommended `pyright[nodejs]`.
- ⛔ **10-30 00:45Z: I retracted my 00:33Z correction.** It was wrong. Main session `sess-1792038484337-jmv3wy`
  (thread `gh-issue-shader-slang/slangpy-1223`, where the babysitter sweep landed at 00:06Z) dispatched
  slangpy-fixer at 00:07:17Z, in parallel with my 00:03Z triager dispatch. At 00:11Z and 00:12:12Z (its rows 305
  and 307) it steered the fixer to `nodeenv>=1.11.1`. So **Orchestrator did choose B**, as the fixer said. Because
  of my false correction, the fixer and triager recorded B as the fixer's own call. I asked both to restore it.
  No GitHub post attributes the choice either way; I checked the PR body and comments 6511811465 and 6511820718.
  After 00:13Z the fixer and triager report to **this** session. The parallel Main session also posted to the dashboard at 00:07Z.
- **10-30 00:40Z [Fix Report]:** slangpy-reviewer APPROVE (0 bugs; G1: wait for the self-hosted typing checks).
  #1251 is still a draft. In run 40979519583, the 4 self-hosted `nvrgfx-kernelvm-bridge` jobs that hit #1250 are
  pending. Next: a human marks the PR ready and merges it after those pass, then the failed Slang "SlangPy Tests" checks are rerun.
- 10-30 00:44Z: the fixer restored the attribution ("Orchestrator's direction, msg 6") in reports/1250.md, the
  fix-report record and its memory, and sent corrections to the reviewer and triager. No GitHub edits. It is
  waiting on G1 (4 self-hosted typing checks, run 40979519583) and will report the result here.
- **10-30 00:44Z [Triage Resolution] (partial):** reviewDecision=REVIEW_REQUIRED, with kaizhangNV as shepherd (expipiplus1 has the most
  history on the file). The 4 self-hosted jobs were still queued at 00:45Z. Triager attribution corrected; no new GitHub post (the 00:27Z fixer comment is current).
  The triager sent this report twice (msgs 850 and 852, identical). **Timer:** one-shot `slangpy-1250-merge-reche-a920` at 2026-10-30T08:00Z.
- **10-30 01:44Z G1 met (I verified at ~01:46Z):** in run 40979519583, all 4 self-hosted jobs have Typing = success.
  3 jobs completed successfully; linux gcc Release was still running its later steps. Per the fixer, the logs show
  `Uninstalling nodeenv-1.10.0`, then node 26.13.0, then pyright 0 errors. #1251 is still a draft with
  REVIEW_REQUIRED. 8 ci-latest-slang runs (00:27Z to 01:37Z) are **queued**. Unverified: they may pass before the
  merge on runners whose toolcache #1251's run upgraded. Dashboard told: it's ready for a maintainer to mark ready and merge.
- **10-30 02:05Z:** the sibling session `jmv3wy` told the fixer to mark #1251 ready and told the dashboard it had.
  The fixer **declined, which is correct** (its spine forbids `gh pr ready`), so #1251 is still a draft with 16 checks
  SUCCESS. I corrected the dashboard: a human has to flip it. The sibling's plan is that after the merge the babysitter reruns `SlangPy Tests` once per affected Slang PR.
- **10-30 08:00Z one-shot re-check (`slangpy-1250-merge-reche-a920`):** #1251 is still OPEN and a draft, REVIEW_REQUIRED,
  with 16/16 checks SUCCESS (head `19389c9e89`). No human review or comment since 00:26Z. `index.json[0]` is still
  `v27.0.0-alpha.0.0.0`. Every ci-latest-slang run through 03:33Z (#14051) failed or was cancelled; the latest failure is in
  Typing Checks with a Traceback (Windows runner, cached nodeenv 1.10.0). So the "may pass before merge" hope at 01:44Z is
  **false** for that runner. Sent the dashboard one reminder (thread gh-issue-shader-slang/slangpy-1250) listing the Slang PRs
  to rerun after the merge: #14072, #13848, #14052, #13918, #13855, #14065, #13925, #14021, #14051, plus the master schedule run.
  No GitHub writes. No timer is armed now: the merge webhook and the babysitter rerun plan carry the chain from here.

## Merged in from the duplicate note of session `jmv3wy` (10-30 10:1xZ)
- At 00:07Z, session `jmv3wy` (the babysitter's sweep session, not the canonical one) also dispatched slangpy-fixer. That made two Main parents. The fixer reported to `qsff21`, and the dispatch led to the "who directed the nodeenv floor" correction and retraction. Hazard recorded in system/hazards.md. `jmv3wy` sends nothing further on #1250.
- At 02:1xZ, `jmv3wy` asked the fixer to `gh pr ready` #1251. The fixer declined, correctly (feedback_fixers_cannot_request_reviewers.md).
- The babysitter's plan after the merge: one `--failed` SlangPy rerun per affected Slang PR, once the newest `ci-latest-slang` run is green. At 10:0xZ it had seen no green run; newest was 40998042565 at 03:33Z.
- **10-30 13:34Z TERMINAL:** jkwak-work's slangpy#1253 (`pyright` → `pyright[nodejs]` in `requirements-dev.txt`, the
  triager's option A) merged. skallweitNV closed #1251 unmerged ("Closing due to fix in #1253") at 13:49Z, and #1250
  closed at 13:49Z. The fixer edited its issue status comment, removed the worktree and sentinel, and left the remote branch.
  I verified all three states at ~13:52Z.
- **Lessons:** (1) **The maintainers chose to bundle node instead of setting a version floor.** For a CI break caused by
  a runtime fetch from an external index, prefer removing the fetch over pinning the fetcher. The sibling Main session's
  steer to B overrode the triager's correct recommendation, A. (2) My "early relief" inference was wrong: the
  ci-latest-slang runs from 01:47Z to 03:33Z all still failed after #1251's run, so the runner toolcache did not
  carry the upgrade across. (3) There have been no ci-latest-slang runs since 03:33Z, so reruns of the red Slang
  "SlangPy Tests" checks are still needed. The sibling session's plan gives these to the babysitter sweep.
