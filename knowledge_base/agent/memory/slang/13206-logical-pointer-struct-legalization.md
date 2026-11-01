---
type: chain
title: slang#13206 — logical pointers in structs (draft PR #13305)
description: SPIR-V logical-pointer struct-field legalization; draft PR #13305 parked on tangent-vector's A/B/C scope decision for array-valued logical pointers
tags: [slang, spirv, type-legalization, parked]
---

# slang#13206 → draft PR #13305

- **Issue:** human-filed (mortenbh) 09-21. "Slangc produces invalid SPIR-V for Slang code involving logical pointers
  in structs". Assignee is tangent-vector, labels `reproduced` and `SPIR-V`.
- **PR:** draft #13305 on `fix/issue-13206-typelegal`. It supersedes #13214, which was closed 09-28 after tangent-vector
  redirected it on 09-23. The PR makes logical pointers "special" leaves, so resource type legalization splits them out of
  structs. It adds E57008 for memory that can't be split. Requested reviewer is jkwak-work. Head was `2fa1283bda` from
  09-29 to 10-31.
- **Owner:** slang-fixer `sess-1790017171938-etva7e` on thread `gh-issue-shader-slang/slang-13206`. It is escalated at
  $281 of a $497 ceiling.
- **Blocker:** the A/B/C scope question for array-valued logical pointers
  ([issuecomment-5881816966](https://github.com/shader-slang/slang/issues/13206#issuecomment-5881816966), 09-29 01:21Z).
  The options: (A) scalarize array values of special leaves, the #9062 path; (B) reject them on SPIR-V with a diagnostic;
  (C) land struct members now and track arrays under #9062. No human has answered.
- **Related, not covered:** #13418 (bot-filed, assigned to jhelferty-nv). It is a `UserPointer` field store mismatch, and
  #13305 splits only *logical* pointer fields.

## History
- 10-02 → 10-24: 7 weekly operator asks ("ping the maintainer, or let it go stale/close"). None got an answer.
- **10-31:** I withdrew that ask as over-gated. The menu never offered the no-ping default, the same pattern as #12674 and
  #11387 ([feedback_github_writes_operator_authorized](../imported/feedback_github_writes_operator_authorized.md)).
  I sent the fixer (its seq 94) to plain-merge master (it was 6 ahead / 196 behind and CONFLICTING), verify locally, push
  without dispatching `ci.yml`, and post one no-ping A/B/C comment. The @-mention ping is opt-in only ("ping 13206").
  The only red CI is run 36526246596, a 09-29 bot `workflow_dispatch` whose falcor-ci gate expired 10-29. It is not a
  code failure.
- **Next:** one-shot `recheck-13206-pr13305-pa-7b5e` at 11-07 09:00Z. If there is still no answer, it parks the chain
  with no timer ([reask cap](../orchestrator/reask-cap-park-after-final-ask.md)), and does not re-arm.
