---
type: chain
title: slang#13311 / PR #13312 — nightly 36520729454 stale agentic tests; now a docs-leftovers PR
description: Bot fix superseded by maintainer #13317, then rescoped by a master merge to 3 docs files. Handed off to maintainer review on 2026-10-02 after the operator's decision went unanswered for 3 rounds.
tags: [slang, nightly-ci, handed-off, operator-decision-unanswered]
---

# slang#13311 / PR #13312

**State (2026-10-02 20:50Z): HANDED OFF to maintainer review on #13312 / the operator. No re-chase scheduled.**

- **Origin:** nightly run 36520729454 had 4 stale agentic-test expectations (WGSL `loop` from #13071,
  empty ray payload from #13256). slang-fixer (session `sess-1790670224358-1v99zr`, thread
  `slang-ci-nightly-run-36520729454`) filed #13311 and opened draft PR #13312.
- **Superseded:** jvepsalainen-nv's #13317 merged 2026-09-29 14:38Z and fixed the same 4 tests.
  The operator was asked on 09-30 ~08:35Z to choose (a) close both, or (b) close both and carry the
  docs leftovers in a docs-only PR. The fixer is HOLDING pending that answer.
- **Premise change, 10-01 01:14Z:** jkwak-work approved #13312 and marked it ready for review. The
  fixer merged master as asked (merge, no force-push) to `4a636578b6`. #13312 now holds only 3 docs
  files (+42/−20) and carries `Fixes #13311`. The push dismissed the approval, and review is
  requested from dshreiner-nv. The `pull_request` checks pass. The workflow_dispatch run 36801051802
  is waiting at `wait-for-human-priority` and the falcor gate.
- **Re-chases:** round 1 (09-30), round 2 (10-01, offered (c): lift the hold and let maintainer
  review proceed, which is the recommendation), round 3 final (10-02, dashboard msg 13). All unanswered.
- **Resumes on:** an operator reply (relay it verbatim to the fixer, pinned to its session), or
  maintainer review on #13312. The PR mapping routes review webhooks to the fixer.
