---
type: project
name: project_13612_bwd_diff_e50101_interface_factory_early_return
description: "slang#13612 (saipraveenb25, self-assigned, 10-13 19:31Z): bwd_diff falsely reports E50101 (dispatch on uninitialized interface) for a [Differentiable] interface factory with early returns; single-return rewrite compiles. Suspected: rev-AD single-return/normalizeCFG leaves undef interface on an infeasible path → typeflow witness merge. Sibling #13611 (fwd_diff padding) is independent. Triaged 10-13 (cmt 6155439640): regression from #9808, producer = normalizeCFG constructSSA; handed off to assignee, no fixer. Open operator decision: file the general correlated-flag false-positive?"
---

# slang#13612: bwd_diff false E50101 on interface factory with early returns

**10-13 19:31Z, `issue_opened`.** Live read ~19:35Z: open, human author saipraveenb25, self-assigned, no
labels, 0 comments, body matches payload. Only session on `gh-issue-shader-slang/slang-13612` was my own
webhook session; no tasks or conversations entry. Sibling #13611 opened one minute earlier, has its own Main
session `sess-1791919864881-snek3u`, and the reporter states the two are independent.

**Disposition** (same as [[project_13527_sm610_vector_interlocked_accumulate_signature]]: maintainer-authored and
self-assigned): dispatched `slang-triager` on the canonical thread to reproduce, check the
`prepareFuncForBackwardDiff` → `analyzeExtractExistentialWitnessTable` hypothesis with a dump, dedup, and
post one 5-bullet. No PR and no fixer unless the assignee asks.

**10-13 21:20Z, triaged** (Main checked the live comment, labels, Type, and that #9808 = `45ccce9a3`). The triager posted
[6155439640](https://github.com/shader-slang/slang/issues/13612#issuecomment-6155439640) (bot, 5478 chars) and added labels
`reproduced`, `regression`, and `Autodiff`, with Type=Bug. Verdict: bug / medium / P2, a **regression from #9808** (`473afb979` OK, `45ccce9a3` fails;
v2026.5.2 OK, v2026.7+ fail). The undefined value comes from `normalizeCFG`, specifically `constructSSA` (cfg-norm.cpp:765) →
`readVar` (ssa.cpp:1121), which emits `LoadFromUninitializedMemory` on the infeasible `_runFlag` path. Typeflow (:2513 → :3766) then reports E50101.
Fix layer: producer (reverse-AD CFG normalization). A typeflow-side drop would hide a true positive. The triager's reverted prototype (keep
undef stores in cfg-norm phi elimination plus Poison for newly introduced undef) passed 1996/1996, and each half alone fails. Scratch:
`/workspace/agent/scratch-13612`, worktree `wt-13612`. **Handed off to the assignee; no fixer, no PR.** It re-opens on a substantive human comment.

**Open operator decision:** whether to file a separate issue for the general path-insensitivity case. A user-written correlated flag
gives a false E50101 with no autodiff, on every release since v2025.24.2. It is noted in the comment and not filed. Asked on `orchestrator-dashboard` 10-13.
