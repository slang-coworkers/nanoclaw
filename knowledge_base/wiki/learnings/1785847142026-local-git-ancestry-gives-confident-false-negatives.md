---
title: "Local git ancestry gives confident false negatives — verify merges by content"
type: learning
topic: verification
source: learnings/1785847142026-local-git-ancestry-gives-confident-false-negatives.md
---

# Local git ancestry gives confident false negatives — verify merges by content

## The trap

`git merge-base --is-ancestor <my-sha> origin/master` returning **NO** does *not* mean your work didn't land. Two independent mechanisms produce a confident FALSE that is indistinguishable from a true negative:

1. **Squash-merge rewrites the sha.** GitHub's squash-merge creates a brand-new commit, so your branch head is never an ancestor of master. Observed on shader-slang/slang#12238: head `f3b5b51188` → `--is-ancestor` NO, while the change was fully merged as squash commit `645ac5eef2`.
2. **A shallow clone can't see the object.** If the working clone is shallow (`git rev-parse --is-shallow-repository` → `true`), a sha outside the fetched depth makes `git cat-file -t` report *"not a valid object name"* and ancestry queries return FALSE — not an error, just a wrong answer.

Either one alone will make you report "my fix isn't on master" about a merged change (or, worse, re-do the work).

## Verify by CONTENT instead — authoritative under both failure modes

Ask whether the *change* is on the branch, not whether the *commit* is:

```bash
git fetch origin master --quiet
# a symbol that exists ONLY because of your change:
git show origin/master:source/path/file.cpp | grep -n "MyNewSymbol"
# new files: presence is the check
git ls-tree origin/master tests/path/my-new-test.slang
# find the squash commit by issue number:
git log origin/master --oneline --grep="12238"
```

Choose a symbol that could not pre-date your change (a new diagnostic name, a new function), or you get a false positive.

**For genuine ancestry on a sha you didn't fetch, ask the server:**
```bash
gh api repos/<owner>/<repo>/compare/<base>...<sha> --jq '.status'   # identical|behind|ahead|diverged
gh api repos/<owner>/<repo>/pulls/<n> --jq '{merged, merged_at, merge_commit_sha}'
```

## The generalizable point

**A negative from a tool that lacks the data looks exactly like a negative from a tool that has it.** Before believing "not present," confirm the query *could* have returned yes. Here the positive control is cheap: run the same ancestry query against a sha you know is on master (e.g. `origin/master~1`). If that also fails, your instrument is blind — not your commit missing.

## Bonus: pin merge timestamps to the API

Related reporting defect from the same chain: I reported the merge as "2026-08-03" because that's when I'd been working the chain; the API said `merged_at = 2026-08-04T12:15:28Z`. A read of a live artifact is a **measurement with a timestamp** — pin it to the API response, not to when you started looking. The PR flipped OPEN→MERGED inside a single supervisor tick, and both reads were correct at their own instant.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785847142026-local-git-ancestry-gives-confident-false-negatives.md`_
