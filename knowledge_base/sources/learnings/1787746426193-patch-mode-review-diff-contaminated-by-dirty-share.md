---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787745070840-zkgsxm
written_at: 2026-08-26T12:13:46.193Z
---

# Patch-mode review diff contaminated by dirty shared checkout (git commit -am)

**What:** In `slang-pr-review-runner`'s `compose-and-run.sh` (and any patch-mode reviewer), patch mode applies the patch to a temp branch off `origin/master` then runs `git -c ... commit -q -am "patch under review (temporary)"`. `commit -am` stages **all modified tracked files**, not just the patch. If the shared checkout `/workspace/agent/slang` has **pre-existing uncommitted modifications** (a coworker's in-flight edit left dirty), those files get swept into the temp commit alongside the applied patch — so Reviewer A reviews `your_patch + unrelated_dirty_files`.

**How it manifested (2026-08-26, PR #12771 CI-YAML hardening):** My patch touched only `.github/workflows/ci-slang-build.yml` (36 lines). Reviewer A's `final-review.md` came back with 1 bug + 3 gaps about `EnumCase` attribute targets, `constexpr`-warning removal, `slang-parser.cpp`, `core.meta.slang`, `slang-syntax.h` — none of which are in the patch. The temp commit stat showed 5 files, not 1. A itself found the CI change "correct and complete."

**Detection (the tell):** The review footer's `reviewed: <sha>` is a synthetic temp commit, but its **file set** is the check. Before trusting a patch-mode verdict, run `git show --stat <temp-sha>` (or read it from reflog: `git reflog | grep -m1 'commit: patch under review'`) and confirm the touched files == the patch's `diff --git` set. A `diff sha256` in the footer is NOT enough — it hashes the contaminated diff and looks self-consistent. This is a [[integrity-fail-guard-dismissal-hazard]] / wrong-binding instance: artifact fine, binding wrong, no built-in signal.

**Reviewer C (clarity) is immune** — `slang-clarity-review-runner` builds an **isolated worktree** from the patch (`wt-clarity-*`) and reads with `git show`/`grep` only, so it reviews exactly the patch. When A and C disagree wildly on WHAT the diff even is, suspect A-side contamination first.

**Fix / workaround:** Ensure the shared checkout is clean before dispatching (`git -C /workspace/agent/slang status --porcelain` must be empty). If dirty, the coworker's work is still recoverable from the temp commit via reflog (~90d) — don't panic-discard. Then re-run A on the clean tree and re-verify the temp-commit file set. Proper upstream fix would be for the runner to `git commit` only the patched paths (e.g. `git apply` + `git add <paths-from-patch>` + `git commit`), or apply the patch in a dedicated worktree like Reviewer C does.

**Gotcha within the fix:** `git status --porcelain` must be run with `-C <repo>` or from inside the repo. Running it from `/workspace/agent` (not a git repo) fails with "not a git repository" and a naive `| wc -l` reads 0 = "clean" — a false all-clear. Verify the git call itself succeeded.
