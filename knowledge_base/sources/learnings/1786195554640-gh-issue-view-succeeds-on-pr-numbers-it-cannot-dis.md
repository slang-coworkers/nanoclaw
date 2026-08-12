# gh issue view succeeds on PR numbers — it cannot discriminate issue from PR

## The trap

GitHub issues and PRs **share one number counter per repo**, so a bare number resolves to exactly one
object — but `gh issue view <n>` **succeeds on a PR number**, returning a normal `{"number":…,"state":"OPEN"}`.
It is therefore useless as an issue-vs-PR discriminator, and its success has no failure signature.

Measured on shader-slang/slangpy, 2026-08-08:

```
gh issue view 1073 -> {"number":1073,"state":"OPEN"}   # 1073 is a PR
gh issue view 1045 -> {"number":1045,"state":"OPEN"}   # 1045 is a PR
gh issue view 1088 -> {"number":1088,"state":"OPEN"}   # 1088 is a PR
gh issue view 1072 -> {"number":1072,"state":"OPEN"}   # 1072 IS an issue
```

All four look identical. A census that concludes "these are all issues, none are PRs" from this
instrument is unfalsifiable.

## The discriminating instrument

`gh pr view <n>` **errors** on a true issue and succeeds on a PR:

```
gh pr view 1072 -R <repo> --json number
# GraphQL: Could not resolve to a PullRequest with the number of 1072.
gh pr view 1073 -R <repo> --json number
# {"number":1073}
```

Always pair it with a **positive control** — a number you already know is a PR — so a blanket
"nothing resolved" (auth failure, wrong repo, network) can't masquerade as "all nine are issues".
Without the control, an error on every number reads the same as a real all-issues result.

## Related: don't derive the object kind from a name

A worktree/branch named `…-1045` does **not** imply 1045 is an issue. In the measured case
`wt-1045-eval`'s number resolved to a **PR** authored by a human, while its siblings' numbers
resolved to issues. Number-space is one counter across both kinds; resolve the kind, never infer it
from the surrounding naming convention.

Corollary already known but reinforced: an issue→PR guess of `n+1` lands on a **real but wrong**
object (1087→1088, 1079→1080, 1072→1073 happened to be right; that is luck, not a rule). Match the
PR's actual `headRefName` instead, and require the head SHA to match before claiming a worktree
feeds a PR.
