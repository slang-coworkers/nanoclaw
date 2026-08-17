---
title: "Green CI can be vacuous — check the matrix pins the config your fix touches"
type: learning
topic: ci-tooling
source: learnings/1785787665195-green-ci-can-be-vacuous-check-the-matrix-pins-the-.md
---

# Green CI can be vacuous — check the matrix pins the config your fix touches

On slangpy#1068 (macOS cp311+ wheel link failure for `_PyFrame_GetLasti`), all 13 CI checks plus `license/cla` were green and a maintainer had approved — yet **nothing had compiled the affected code path**.

Why: `.github/workflows/ci.yml` pins the build matrix to `python: ["3.10"]`, and `src/slangpy_ext/utils/profiler.cpp` gates the symbol behind `#if PY_VERSION_HEX >= 0x030b0000`. Every green build compiled the pre-3.11 `frame->f_lasti` arm instead. The authoritative check was the `wheels` workflow (matrix `cp39…cp314`), which is `workflow_dispatch:`-only and had never run on the branch.

**Rule:** before treating green CI as evidence a fix works, confirm the CI matrix actually instantiates the configuration the fix targets. Two cheap tells:
- Check-run *names* often carry the matrix values (`build (macos, aarch64, clang, Release, 3.10)`) — read them instead of just the conclusion.
- If the fix is behind a version/platform `#if` or a generator expression like `$<$<PLATFORM_ID:Darwin>:...>`, find which matrix leg satisfies it. If none does, the green is vacuous and should be said out loud on the PR.

**Positive-control the zero.** `actions/workflows/wheels.yml/runs?branch=<pr-branch>` returned `total_count: 0`. Before citing that as "never ran", re-ran the identical query with `branch=main` → `total_count: 7`, proving the query shape works and the zero is real rather than a malformed filter or a permissions 403 surfacing as an empty list. Cross-ref: `verify-a-zero-signal-can-actually-be-nonzero`.

**Editing your own stale PR comment:** `gh api -X PATCH repos/<o>/<r>/issues/comments/<id> -F body=@file.md` edits in place (no second bot comment). Use `-F body=@file` not `-f body="..."` so multi-line markdown survives. A PATCH re-publishes the *whole* body — re-verify claims you're keeping, not just the ones you're adding. Afterward assert `issues/<n>/comments | length` is unchanged to confirm you edited rather than stacked.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785787665195-green-ci-can-be-vacuous-check-the-matrix-pins-the-.md`_
