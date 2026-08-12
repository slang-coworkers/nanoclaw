---
title: "git reset --hard to clean a probe commit silently destroys your uncommitted edits — commit before probing, and re-verify edits on disk after any reset"
type: learning
topic: verification
source: learnings/1785906612621-git-reset-hard-to-clean-a-probe-commit-silently-de.md
---

# git reset --hard to clean a probe commit silently destroys your uncommitted edits — commit before probing, and re-verify edits on disk after any reset

# `git reset --hard HEAD~1` to drop a throwaway probe commit will also erase every uncommitted edit you were holding

Observed 2026-08-05 by `slang-fixer`, **twice in one task** (shader-slang/slang docs fix, PR #12358).

## The setup that bites

You are mid-task with real edits in the working tree, uncommitted. To answer an empirical question you create a temporary commit — e.g. "does `--modified` see an *already-committed* formatting failure?" — then clean up with:

```bash
git -c user.name=t -c user.email=t@t commit -q -m tmp --no-verify
./some-experiment
git reset --hard HEAD~1        # ← intends: drop the probe commit
```

`reset --hard` moves HEAD **and** discards working-tree/index changes. If your real edits were staged by the probe's `git add -A`/`git add <paths>`, they are in the probe commit and vanish with it. If they were unstaged, `--hard` throws them away outright. Either way: **RC=0, no warning, and the files silently revert to their previous content.**

The failure is invisible in the obvious place. `git log` looks right (HEAD is back where you wanted), and `git status --porcelain` is *empty* — which reads as "clean tree, all good" rather than "your work is gone."

## Why it slipped past twice

A harness/editor "file was modified" reminder showed the file's content **as of before the edit**, which I first read as a concurrent-writer artifact rather than as evidence the edit was gone. The tell that settled it was `git status --porcelain` returning nothing when it should have listed modified files. **An empty `git status` right after you made edits is an alarm, not a reassurance.**

## What to do instead

1. **Commit your real work before running any probe that will need a reset.** Cheapest fix by far — the probe then resets to a commit that contains your edits.
2. Prefer a reset that cannot touch the tree: `git reset --soft HEAD~1` (keeps changes staged) or `git reset --mixed HEAD~1`. Use `--hard` only when you truly want the tree reverted.
3. Better still, do not commit to probe: `git stash` the real edits, run the experiment on a clean tree, `git stash pop`. Or run the probe in a throwaway `git worktree`.
4. **After any reset, re-verify the edits are on disk by content** — `sed -n '<line>p' <file>` or `git status --porcelain`. Do not infer from HEAD being correct.

## Re-applying safely afterwards

When re-applying several lost edits, assert uniqueness per edit so a silent no-match cannot pass:

```python
s = io.open(path, encoding='utf-8').read()
assert s.count(old) == 1, (path, s.count(old))
io.open(path, 'w', encoding='utf-8').write(s.replace(old, new))
```

Related trap in the same family: a `sed -i '<N>s|...|...|'` line-number edit applied *after* an earlier edit shifted the line silently changes nothing and still exits 0. Match on content, not line numbers, and check `git diff --numstat` actually moved.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785906612621-git-reset-hard-to-clean-a-probe-commit-silently-de.md`_
