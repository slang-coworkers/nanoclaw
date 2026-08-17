---
title: "Git commands whose filter narrows the DIFF but not the MESSAGE (or the other way round) produce valid commits that do the wrong thing"
type: learning
topic: misc
source: learnings/1786044389931-git-commands-whose-filter-narrows-the-diff-but-not.md
---

# Git commands whose filter narrows the DIFF but not the MESSAGE (or the other way round) produce valid commits that do the wrong thing

Two near-misses in one session on shader-slang/slang#12401, same underlying shape: a git command
whose *filter* semantics differed from what I assumed, producing a **valid commit that pushes
cleanly** while doing something other than intended. Neither would be caught by "did the command
succeed?" — both exit 0.

## 1. `git rm --cached <path>` is not "drop this file from my commit"

Wanting to remove one file from a commit I was about to `--amend`, I ran
`git rm --cached .github/workflows/ci-slang-test.yml` then `commit --amend`. That does not restore
the file to its parent state — it stages a **deletion**. The diffstat showed
`.github/workflows/ci-slang-test.yml | 263 ---------` : a commit that deletes an entire existing CI
workflow, which would have pushed without complaint.

- **The verb for "revert this path to the base's version" is** `git checkout <base-ref> -- <path>`
  (or `git restore --source=<base-ref>`), **never** `git rm --cached`.
- **Read the diffstat of every `--amend` before pushing.** A deletion you never intended looks
  identical to a successful amend at the exit-code level. The diffstat is the only thing between it
  and master.
- Confirm the restore: `git diff <base-ref> -- <path>` should be **empty**, and sanity-check the
  line count (`wc -l < path`) rather than trusting "the amend succeeded."

## 2. `git format-patch -1 -- <path>` filters the diff and keeps the WHOLE message

To hand off a 6-line YAML hunk I couldn't push (GitHub App token lacking `workflows` permission), I
ran `git format-patch -1 --stdout -- <path>`. The path filter applies to the **diff only**. The
emitted patch carried my full commit message — which described the prelude change, the aliasing
argument, the measurement sweep, and "adds an offline-nvcc fixture" — attached to a diff containing
none of it.

Worse, that subject began `Fix shader-slang/slang#12401:`. In the fully-qualified `owner/repo#num`
form that is a **GitHub auto-close reference**: `git am` + merge would have **closed the issue**
while the actual fix sat unmerged on a draft branch. A reviewer applying the patch in good faith
would have silently resolved the wrong thing.

- When splitting a hunk out of a commit, **write a new message scoped to the new diff.** Don't
  inherit one.
- Use `Refs #N`, never `Fix`/`Fixes`/`Closes`, on a companion/split commit that doesn't itself fix
  the issue. Grep the finished patch: `grep -nE '^(Subject|Fix|Fixes|Closes|Refs)' <patch>`.
- **Auto-close keywords work in the `owner/repo#num` form too** — scoping a reference to another
  repo does not make it inert.

## The generalisable check

Before handing anyone a patch, apply it the way they will, to a **pristine** copy of the base — not
to your own worktree, which already contains the change and will confirm anything:

```bash
git --git-dir=<repo>/.git show origin/master:<path> > <clean>/<path>   # pristine, not your edit
cd <clean> && git am <patch>            # the mode they'll use
git log -1 --format=%s && git show --stat --format='' HEAD   # subject scoped? diffstat right?
```

Then validate the artifact with a tool **plus a control** that proves the tool discriminates (I ran
`prettier --check` on the resulting YAML, then re-ran it on deliberately-broken YAML → rc=2, so the
clean result meant something).

Meta-lesson: I surfaced #1 to my parent proactively and it cost nothing; #2 was caught by my parent
reading the artifact I'd sent. **Reporting a caught error is cheap; an unreported one becomes the
next reader's bug.** Also: `$?` after a pipe measures the last stage — capture `rc=$?` on its own,
or check `${PIPESTATUS[0]}`.


## See also — trigger-keyed siblings

This note is organised by shared *cause*. The same two traps also exist as separate notes keyed by
*detector*, because the detectors diverge and the detector is what a reader needs at the moment of
the error (diffstat catches #1; only a patch-header grep catches #2):
- `1786042764028-git-rm-cached-while-amending-stages-a-full-file-de.md`
- `1786044350330-git-format-patch-with-a-path-filter-keeps-the-full.md`

The pristine-apply procedure and the `PIPESTATUS` caveat above are unique to this note.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786044389931-git-commands-whose-filter-narrows-the-diff-but-not.md`_
