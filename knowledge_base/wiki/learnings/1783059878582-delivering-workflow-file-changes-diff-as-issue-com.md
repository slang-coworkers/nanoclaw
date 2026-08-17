---
title: "Delivering workflow-file changes: diff-as-issue-comment + RelWithDebInfo output-dir"
type: learning
topic: misc
source: learnings/1783059878582-delivering-workflow-file-changes-diff-as-issue-com.md
---

# Delivering workflow-file changes: diff-as-issue-comment + RelWithDebInfo output-dir

When a Slang fix edits ONLY `.github/workflows/*`, the `nv-slang-bot` GitHub App CANNOT push it — GitHub server-rejects App pushes that create/update workflow files without the `workflows` permission (observed #11773, #11926). Deliverable = a `git apply`-able unified diff posted as an **issue comment** for a maintainer to apply by hand; do NOT branch/PR/enqueue. No Reviewer-A/peer step (no PR to review); the maintainer's own apply-time review is the review. Author the diff in a throwaway worktree, verify with `prettier --check <files>` (valid YAML + no style drift) and `git apply --check <patch>` against the pristine base clone, then `git worktree remove --force`.

PATH TRAP for the sanitizer CI artifact: the reusable `ci-slang-sanitizer.yml` builds config `releaseWithDebugInfo`, but `.github/actions/common-setup/action.yml` sed-maps that preset name to the CMake config **`RelWithDebInfo`** and exports `lib_dir=$(pwd)/build/RelWithDebInfo/lib` (+ `bin_dir`). So the on-disk libs live at `build/RelWithDebInfo/lib`, NOT `build/releaseWithDebugInfo/lib` (the preset name). Collect from the exported `$lib_dir` env var (single source of truth, shell-expanded in `run:` steps) rather than hardcoding either path. Gate a nightly-only artifact via a `publish-binaries` boolean input (default false) on the reusable workflow, set true only in `nightly-slang-sanitizer-test.yml`; the `ci.yml` per-PR caller leaves it default so PRs don't publish. `-shared-libsan` builds need a matching clang/ASan runtime downstream → ship a manifest with `clang-18 --version` + `clang-18 -print-runtime-dir`.

ASan runtime-flag facts (corrected via codex): all of `detect_stack_use_after_return` / `check_initialization_order:strict_init_order` / `detect_odr_violation` are pure runtime toggles (no rebuild). ODR violations are NOT fatal-at-load — under `halt_on_error=0` they log+continue and emit a `SUMMARY:` line that `cmake/expected-sanitizer-findings.txt` can neutralize like any finding; `detect_odr_violation` runtime default is already 2 (explicit set may be a no-op). Stage ODR=2 separately behind a `workflow_dispatch` dry-run because it's the strictest/most-FP-prone level firing at load across every test process (PR-gate noise), NOT because it aborts. Don't claim `detect_stack_use_after_return` is currently off — it may already default on for Linux clang.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783059878582-delivering-workflow-file-changes-diff-as-issue-com.md`_
