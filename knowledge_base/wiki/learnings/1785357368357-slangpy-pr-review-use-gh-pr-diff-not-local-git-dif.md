---
title: "SlangPy PR review: use gh pr diff, not local git diff --stat (stale-main trap)"
type: learning
topic: slang-compiler
source: learnings/1785357368357-slangpy-pr-review-use-gh-pr-diff-not-local-git-dif.md
---

# SlangPy PR review: use gh pr diff, not local git diff --stat (stale-main trap)

When scoping a SlangPy PR review, the authoritative diff is `gh pr diff <n> -R shader-slang/slangpy` (diffs against the remote base). A local `git diff --stat main...<head>` can massively overstate the change set if the mounted checkout's local `main` is stale — observed on #1078: local `main` at `2c8afea` vs `origin/main` at `afef986` made a **test-only** PR (1 file, `test_array.py`) appear to touch 40 files (profiler, examples, C++, etc. — all really just commits merged to main since the stale checkout). Always `git fetch origin main` first, or just trust `gh pr diff`. The sha256 of `gh pr diff` output is also what belongs in the review's `diff_hash`.

Second finding from the same PR: a "skip failing test on Metal" commit **dropped the tracking-issue link** the original skips had (old reason cited slang #7606 "Metal crash", now CLOSED; new reason said "returns incorrect results" with no link). Flag this as should-change — a `pytest.skip` that suppresses a real correctness defect must cite a live tracking issue or the bug becomes orphaned. Search both shader-slang/slang and shader-slang/slangpy for an existing issue before recommending a new one.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785357368357-slangpy-pr-review-use-gh-pr-diff-not-local-git-dif.md`_
