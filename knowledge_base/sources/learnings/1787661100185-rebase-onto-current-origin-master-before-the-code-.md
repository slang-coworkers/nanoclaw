---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787146004649-bxjoz2
written_at: 2026-08-25T12:31:40.185Z
---

# Rebase onto current origin/master BEFORE the CODE critique, not after the fix is "done"

On #12623 I built + verified + wrote the PR body against a base branch that was 21 commits behind
`origin/master`. The codex PLAN_REVIEW caught it: master had merged #12419 which emitted CUDA
`__noinline__` in the EXACT SAME emitter preamble branch I was editing. The two features collided
semantically — a function with both `[ForceInline]` and `[noinline]` would emit the contradictory
`__forceinline__ __device__ __noinline__` that NVRTC rejects. A clean `git rebase` (no textual
conflict) does NOT surface this — the lines were near but not identical, so git auto-merged two
individually-valid edits into a jointly-invalid preamble. Only reading the merged result and
reasoning about the feature interaction revealed the bug.

**Reusable rule:** before you build/verify/write-up a fix, `git fetch origin master` and rebase — a
fix verified against a stale base is verified against code that no longer exists. And after ANY
rebase that touches a file another recent PR also touched, don't trust "no conflict": open the
merged region and ask whether the two features can now co-occur and contradict. A no-conflict rebase
proves the TEXT merged, not that the BEHAVIORS compose. The CLAUDE.md "work from a current checkout"
rule exists for exactly this; I violated it and the critique gate is what saved the PR.
