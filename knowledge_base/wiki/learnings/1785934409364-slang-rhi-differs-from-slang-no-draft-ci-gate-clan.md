---
title: "slang-rhi differs from slang: no draft CI gate, clang-format v20.1.7, main branch, build/ layout"
type: learning
topic: slang-compiler
source: learnings/1785934409364-slang-rhi-differs-from-slang-no-draft-ci-gate-clan.md
---

# slang-rhi differs from slang: no draft CI gate, clang-format v20.1.7, main branch, build/ layout

Working shader-slang/**slang-rhi** with habits from shader-slang/**slang** produces wrong actions. Four concrete divergences, all verified 2026-08-05 on slang-rhi#787 / PR #812:

1. **`ci.yml` has NO draft gate.** slang-rhi's `ci.yml` triggers on `pull_request` with only `paths-ignore` — no `github.event.pull_request.draft != true` filter (grep for "draft" in the file returns nothing). So **CI auto-runs on draft PRs** and the slang-repo rule "explicitly `gh workflow run ci.yml` after every push to a draft" is **redundant here** — and actively harmful, since a manual `workflow_dispatch` can add a confusing extra run. Verified: opening draft PR #812 produced `ci | pull_request | queued` + `pre-commit | success` with 21 checks registered, zero manual dispatch. **Check the workflow's actual trigger block per repo instead of porting the rule.**

2. **clang-format is pinned v20.1.7**, not slang's v17. From `.pre-commit-config.yaml` (`mirrors-clang-format` rev `v20.1.7`). Install: `pip install clang-format==20.1.7 --break-system-packages` → binary at `/home/node/.local/bin/clang-format` (not on PATH). Using v17 risks mis-formatting vs CI. There is also a repo-local ASCII hook: `python3 tools/check_ascii_hook.py <files>` (runs on `.cpp/.h/.c/.py/.slang/.slangh`).

3. **Default branch is `main`**, not `master`. `git fetch origin master` fails with `couldn't find remote ref master`. Base PRs on `main`.

4. **Artifact path depends on the generator actually used in your worktree.** `AGENTS.md` documents the multi-config Ninja layout (`build/Debug/slang-rhi-tests`), but a worktree configured with **Unix Makefiles** puts it at **`build/slang-rhi-tests`**. An `ls build/Debug/slang-rhi-tests` probe printed "NO TEST BINARY" against a genuinely green `BUILD_EXIT=0` + "Built target slang-rhi-tests" — the probe was wrong, not the build. Confirm with `grep -m1 CMAKE_GENERATOR: build/CMakeCache.txt` or `find build -name "slang-rhi-tests"`.

**Bonus test-harness trap:** `./build/slang-rhi-tests -tc="texture-shared-cuda"` reports `0 passed | 0 failed | 831 skipped` and `Status: SUCCESS!` — a **vacuous pass**. The shared-CUDA interop cases are inside `#if SLANG_WIN64` and are not compiled into a Linux binary at all. Confirm registration with `-ltc` (list test cases), and always pair an emptiable filter with a positive control (`-tc="*buffer*"` → 71 cases ran) so you can tell "filter matched nothing" from "tests passed".

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785934409364-slang-rhi-differs-from-slang-no-draft-ci-gate-clan.md`_
