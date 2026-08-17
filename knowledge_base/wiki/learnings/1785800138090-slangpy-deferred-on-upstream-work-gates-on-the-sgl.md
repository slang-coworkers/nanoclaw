---
title: "SlangPy deferred-on-upstream work gates on the SGL_SLANG_VERSION pin, not on a wheel release"
type: learning
topic: slang-compiler
source: learnings/1785800138090-slangpy-deferred-on-upstream-work-gates-on-the-sgl.md
---

# SlangPy deferred-on-upstream work gates on the SGL_SLANG_VERSION pin, not on a wheel release

When a SlangPy test/fix is deferred until "the upstream Slang fix ships", the natural reading — "wait for the next SlangPy release/wheel" — is **wrong** and will make you re-add a test that still fails for the original reason.

SlangPy bundles Slang as a **release tarball** pinned by `SGL_SLANG_VERSION` in `external/CMakeLists.txt:85`. The pin moves only when someone bumps it, and it lags badly: on 2026-08-03 it was still `2026.12`, last bumped 2026-06-30 (#1037) — five Slang releases behind. A wheel cut on any given day bundles whatever the pin says, not the newest Slang.

So the gate is a **three-stage chain**, and each stage needs its own check:

1. `merge` — `gh api repos/shader-slang/slang/pulls/N --jq '.merged, .merge_commit_sha'`
2. `tag containing the merge commit` — NOT just "a newer tag exists". Use
   `gh api repos/shader-slang/slang/compare/<tag>...<merge_sha> --jq '.status'` and require
   `behind` or `identical`. `ahead` means the commit is NOT in that tag. (Concrete case: slang#12299's
   `546ad18f` merged 08-03T21:28Z and was 25 commits *ahead* of `v2026.14.1`, the newest tag — so in
   no released tarball despite the tag being newer than most of the work.)
3. `slangpy pin bump` — the actual gate:
   `gh api repos/shader-slang/slangpy/contents/external/CMakeLists.txt --jq '.content' | base64 -d | grep SGL_SLANG_VERSION`
   Runtime equivalent on an installed wheel: `python -c "import slangpy; print(slangpy.SLANG_BUILD_TAG)"`
   (bound in `src/slangpy_ext/slangpy_ext.cpp:114` from `spGetBuildTagString()`).

**You usually don't have to wait for any of it to verify.** `.github/workflows/ci-latest-slang.yml` builds slangpy `main` against Slang **master** — nightly 01:00 UTC cron, `workflow_dispatch` with `slang_branch`, and `repository_dispatch` from Slang PRs (the latter fires per-PR: slang#12299 got runs `30836651948` and `30848628629`, both green including the GPU `Unit Tests (Python)` step, before it merged). Checking for an existing cross-repo run for the upstream PR is the cheapest possible confirmation that a fix works against slangpy. Local equivalent: `SGL_LOCAL_SLANG=ON -DSGL_LOCAL_SLANG_DIR=<slang>`.

Note the two lanes differ: `build-pr` (repository_dispatch) is a reduced Linux+Windows Release matrix; the nightly `build` covers Debug and macOS too. A green cross-repo run is real evidence but not full-matrix evidence.

Corollary for chain reports: "fixed upstream" and "available to slangpy" are separated by two unbounded human steps. Say which one you mean.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785800138090-slangpy-deferred-on-upstream-work-gates-on-the-sgl.md`_
