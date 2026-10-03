---
name: project_9580_glsl_legalize_layout_mismatch
description: "slang#9580 chain state: GLSL varying-legalization crash for an entry point returning an associated type of an `export` struct. Fix = front-end PR #12131 (fixer-owned, non-draft, head ced217320c, CHANGES_REQUESTED sticky from tangent-vector, unchanged since 07-31). Parked on the maintainer: jkwak-work deferred it 07-31, 08-20, and on 09-14 pushed it to Q4. Resume on jkwak's return or a substantive human comment. Root cause + design: project_9580_root_cause_and_front_end_fix_design."
metadata: 
  node_type: memory
  type: project
  originSessionId: ae284e48-0735-45e1-95e5-8a218979832f
---

# #9580 — chain state

Mechanism, the rejected #10030 approach, the accepted fix and its residuals:
[[project_9580_root_cause_and_front_end_fix_design]].

## Current state (live-verified 2026-10-03)

- **#9580** OPEN, assignee jkwak-work. **PR #12131** (`fix/issue-9580` → `master`, `Closes #9580`)
  OPEN, non-draft, head `ced217320c`, `reviewDecision=CHANGES_REQUESTED`. The PR has not moved
  since 2026-07-31.
- **Parked on the maintainer, by schedule, not rejection.** jkwak-work on #9580: 07-31 "pushing the
  issue by two sprints"; 08-20 "I don't think I will have enough bandwidth… pushing this by two more
  sprints"; 09-14 "This turned out to be a tricky one to resolve properly. I am pushing it to Q4."
- **Resume:** jkwak returns, or a fresh substantive human comment on #9580 / #12131. Webhook-driven.
- **Owners:** the fixer owns the PR (verify and relay only, never merge); the triager owns the
  fixer edge and the GitHub posting on canonical thread `gh-issue-shader-slang/slang-9580`. Main
  does not double-dispatch. Ready-flip and merge are jkwak's call in his own words.

## Timeline

- **07-09** Triager reproduced and bisected (to PR #8603), posted the verdict
  ([4920403540](https://github.com/shader-slang/slang/issues/9580#issuecomment-4920403540)), applied
  `reproduced`. jkwak asked for a solution that conforms to the #10030 review; the bot proposed a
  front-end fix and jkwak green-lit it but asked for a clearer restatement
  ([4940132728](https://github.com/shader-slang/slang/issues/9580#issuecomment-4940132728)).
- **07-11** jkwak: "go with the sibling approach" and file a `makeStruct` issue assigned to him
  ([4975514968](https://github.com/shader-slang/slang/issues/9580#issuecomment-4975514968)).
- **07-16** jkwak nudged ("can you review my previous comment?"); the triager answered honestly
  that neither deliverable had landed yet
  ([4986948079](https://github.com/shader-slang/slang/issues/9580#issuecomment-4986948079)). The
  triager's "fixer not addressable" report that day was a transient SendMessage glitch, not the
  [[project_slang_fixer_auth_outage]] pattern: the destination edge and fixer group were healthy.
  Same day: draft PR #12131 opened, #12132 and #12134 filed, peer review APPROVE_WITH_NITS with 0
  bugs, fixer 5-bullet posted
  ([4987700605](https://github.com/shader-slang/slang/issues/9580#issuecomment-4987700605)).
- **07-17** jkwak flipped #12131 ready himself and left COMMENTED "Looks good to me. But I like to
  discuss more before merging it." Approver shadow run: WOULD_APPROVE (Devin-only tier because
  production review skips bot-authored branches; clauses 6/6; challenger clean). The red combined
  status was non-causal (falcor D3D12 image-diff, linux-only SlangPy profiler timing).
- **07-24** tangent-vector filed CHANGES_REQUESTED (r3647578389): extract one resolve bottleneck,
  and consider a systematic resolver. The earlier "WOULD_APPROVE, await merge" state is
  **superseded**.
- **07-31** Rework landed at `ced217320c` (bottleneck extracted; systematic resolver posed as an
  on-thread question). CHANGES_REQUESTED stays sticky pending tangent-vector's re-review. jkwak
  deferred the issue the same day, then again 08-20 and 09-14 (above).
