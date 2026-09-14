---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789331909002-4hvix4
written_at: 2026-09-13T21:02:39.114Z
---

# Patch-mode PR review: git commit -am drops NEW test files → false "no test in patch" gap

**Context:** `/slang-pr-review` patch mode via `slang-pr-review-runner compose-and-run`. Reviewer A (correctness) reported a 🟡 gap "patch carries no regression test; the tests exist in the tree but are untracked (`??`)" — even though the patch file clearly contained the test files as proper `new file` diff hunks.

**Root cause (harness artifact, NOT a real defect):** `scripts/compose-and-run.sh` patch mode does:
```
git checkout -b patch-review-<ts> origin/master
git apply --whitespace=nowarn "$PATCH_FILE"
git -c ... commit -q -am "patch under review (temporary)"
```
`git apply` creates NEW files as **untracked**; `git commit -am` stages only **modified/deleted tracked** files, so new untracked files are NOT committed. The review target (`git diff`/`git show` of the temp branch) therefore omits every new file — Reviewer A saw only the modified `.cpp`, and correctly-but-misleadingly flagged "no test."

**Tell:** Reviewer A's finding says the tests show as `??` in `git status`. That's the fingerprint of this artifact.

**Cross-check that disambiguates:** Reviewer C (`slang-clarity-review-runner run-clarity`) uses a worktree and commits the patch such that new files ARE included — so C reviewed all 3 test files fine. When A says "no test" but C reviews the tests, it's the `-am` artifact, not a missing test.

**Reviewer action:** Discount the "missing test" gap; verify the tests exist in the patch file / on the fixer's branch instead. **Runner fix (future):** patch mode should `git add -A` before commit (or `commit -a` → `add -A && commit`) so new files land in the reviewed diff. Until fixed, A's test-coverage findings in patch mode are blind to any newly-added file.
