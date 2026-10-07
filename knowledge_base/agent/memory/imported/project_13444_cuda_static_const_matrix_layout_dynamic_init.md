---
type: project
name: project_13444_cuda_static_const_matrix_layout_dynamic_init
description: "slang#13444 (bot-filed 10-05 19:00Z by slang-fixer on the #13378 chain): CUDA module-scope static const matrix with non-default layout -> dynamic __device__ init (NVRTC error). Array form is a THIRD #12992 regression (passes v2026.19, fails a459ba415b+). Owned by the #12992 chain; NO fixer dispatched; covered by rechase-13376-13375-a3ba."
metadata:
  node_type: memory
  type: project
---

# slang#13444 — CUDA static-const matrix layout conversion emits dynamic `__device__` init

**Origin.** Found by the synthesized CUDA leg (`.7 syn`) of `tests/language-feature/types/matrix-layout-array-coerce.slang`
in #13378, during classification of that PR's red CI (run 37344546139). Filed by slang-fixer session
`sess-1790885152461-qoc687` (thread `gh-issue-shader-slang/slang-13376`, msg 65, 19:00Z) on the order of the #12992-chain
Main (`sess-1790881765830-saa1xb`, thread `-13375`). Sibling filing: #13443 (SPIR-V `-g2` unsized-array OpAccessChain).

**Content.** Single-matrix form fails since ≥ v2026.13.1; array form passes v2026.19 and fails from #12992's merge
`a459ba415b` (not a strict bisect: `3e98d9563f` not built). IR: module-scope `floatCast` from the default-layout
`makeMatrix` constant, emitted by CUDA as a dynamic `__device__` initializer. Related: #12635 (closed), #8313.

**Disposition: owned, nothing dispatched.** The `issue_opened` webhook was the filing's self-echo; owner ladder hit on
rung 1 (fixer session) and rung 4 (re-chase task, which already names #13444 at its 19:02Z update). #13378 carries an
expected-failure entry for `.7 syn (cuda)` citing #13444.

**Resume path.** `rechase-13376-13375-a3ba` (19:30Z 10-05, re-arms ~2h): "#13443 and #13444 have no fix dispatched;
once #13378 is green, consider asking the triager or fixer." A non-bot comment routes on `gh-issue-shader-slang/slang-13444`.

**10-05 20:45Z:** jkwak-work assigned the issue to themselves and set the Q4 2026 milestone. **10-06 16:31Z:** jkwak-work commented "@nv-slang-bot can you triage the issue?"
(comment 6020786658). The comment was routed verbatim, with `<github-post-authorized />`, to slang-fixer, pinned to `qoc687`, on thread
`gh-issue-shader-slang/slang-13444` (msg 31). The scope is triage only: a fix PR needs a go-ahead. The re-chase task `rechase-13376-13375-be74` was updated
to watch for the triage post and to nudge once if the fixer is silent for more than 2h.
