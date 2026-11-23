---
type: chain
title: "slang#14672 — migrate slangc multiple-source-files test into slang-test, remove tools/slangc-test (PR #14675)"
description: Maintainer-filed test-infra cleanup; fix shipped as PR #14675, maintainer-flipped ready, awaiting re-approval + merge
---

# slang#14672 → PR #14675

HUMAN-filed 11-20 20:41Z by **jkwak-work** (MEMBER; cleanup proposal with concrete plan + acceptance criteria; covers #6221 via PR #6306's one-off shell test). R6 dispatch: 👀 posted, triager on canonical thread `gh-issue-shader-slang/slang-14672` (sess faxby7) 20:45Z.

**Triage 20:52Z** (comment 7050403771): enhancement (test-infra cleanup) / low / P2 / CI; Issue Type set Feature. All claims verified on master incl. one the issue missed (extras/ci-gpu-stress-loop.py:534,551 also tarballs tools/slangc-test). Solution A chosen: `//TEST:SIMPLE` on source1.slang (SIMPLE prepends test file first, slang-test-main.cpp:3875-3878, preserving the load-bearing non-last-import order) with source2.slang as directive arg.

**Fixer chain** (sess v89zbl, triager-dispatched 20:53Z; pr-mapping row 14675 → v89zbl, 21:58Z):

- [Fix Report] 23:04Z, **Main-live-verified**: PR **#14675** (slang-coworkers fork, maintainer_can_modify=false — origin push rejected, App lacks workflows permission), 11 files +27/−82, 4 commits. Test migrated verbatim to `tests/language-feature/modules/multiple-source-files/`; tools/slangc-test/ deleted; CI steps stripped from the 3 workflows (+ both SLANGC_TEST_EXIT consumers; SLANG_TEST_EXIT halves kept) and the GPU stress-loop tarball. Nit commits added `//TEST_IGNORE_FILE:` companions + path-resolution-rule docs + trailing newlines. Acceptance 1/1, modules/ 56/56, zero repo-wide slangc-test refs, workflows prettier-clean.
- **Review complete:** 3-reviewer peer APPROVE_WITH_NITS (0 bugs/gaps/questions, nits applied, no new round); codex CODE_REVIEW approve at final head. Final head **`66aba89e19c7ef7485e5c353025ec40babc0cd37`**.
- **Maintainer jkwak-work:** flipped the draft READY himself **22:30:43Z** and APPROVED at 6bdd627 (22:31:26Z, "Looks good to me") — approval auto-DISMISSED by the nit push (GitHub stale-approval mechanics). **Remaining human action: re-approval at head 66aba89e + merge** (mergeable:true, mergeable_state blocked on the review). CI green at final head (check-runs success). Explanation comment 7051724136 tracks head.
- The fixer's ack cmt 7052223809 (22:32Z) says "PR stays draft" — stale at post time (flip was 22:30Z); fixer asked to refresh if warranted.

**Update 11-22 05:22Z (Main live-verified):** maintainer-requested master sync done — #14674's slang-test CI tier split had rewritten the removed `Run slangc tests` step (the one conflict; resolved in favor of the deletion). Head is now merge commit **`2deaddee`** (no force-push, per merge-not-rebase rule); acceptance 1/1 + modules 56/56 re-run green at merged head (log reports/prbody-14672/merge-test-log.txt); explanation comment updated in place; ack 7074666064 → done 7074714634. CI re-runs at 2deaddee; **remaining human action unchanged: jkwak-work re-approval + merge** (mergeable_state blocked on review).

**State (11-20 23:3xZ):** TERMINAL our side — awaiting maintainer re-approval + merge; webhook-driven from here (review/merge events route to fixer via pr-mapping). No ready-flip list entry needed (maintainer flipped it). PR body carries `Fixes #14672` → issue auto-closes on merge (triager-verified). Triage Resolution delivered; issue cmt 7050403771 PATCHed to final verdict.

Do **not** re-dispatch webhooks for #14672 / PR #14675 — fixer session v89zbl owns them.
