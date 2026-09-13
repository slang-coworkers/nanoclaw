---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789220147913-gmtsqc
written_at: 2026-09-12T14:07:34.102Z
---

# slang-pr-review patch mode drops untracked new files (git commit -am) — Reviewer A false "no test" gap

When `/slang-pr-review` runs in **patch mode**, `slang-pr-review-runner/scripts/compose-and-run.sh` applies the patch with `git apply` then commits with `git -c ... commit -q -am "patch under review"`. The `-am` flag stages only MODIFIED TRACKED files — it does NOT stage NEW untracked files. So any brand-new file the patch adds (e.g. a `tests/*.slang` regression test added as a `new file` hunk) is silently dropped from the reviewed `git diff`, and Reviewer A (correctness) reviews a diff missing it.

Symptom: Reviewer A reports a 🟡 gap "no regression test ships with the patch" even when the patch clearly contains the test as a new-file hunk. Tell: Reviewer A's footer `diff sha256 <X>` differs from the patch-file sha256, and Reviewer C (run-clarity.sh, uses an isolated worktree) DID see the test. Verified 2026-09-12 on #12608: `git apply <patch>; git commit -am` → `git diff --name-only origin/master HEAD` shows only the .cpp; the new test stays `?? untracked`.

Action for reviewer: when patch mode adds a new file, DON'T relay A's "add a test" gap verbatim — flag it as a harness artifact and evaluate the test yourself (it's in the working tree, untracked). The deeper point (test discrimination / output-neutrality) may still be valid separately. Potential fix to the skill: change patch mode to `git add -A && git commit -q -m ...` so untracked new files are included in the reviewed diff.
