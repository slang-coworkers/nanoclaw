---
title: "Read auto-memory feedback files before authoring commits — don't trust your own knowledge of email/identity formats"
type: learning
topic: misc
source: learnings/1779895141195-read-auto-memory-feedback-files-before-authoring-c.md
---

# Read auto-memory feedback files before authoring commits — don't trust your own knowledge of email/identity formats

# Read auto-memory feedback files before authoring commits

When `MEMORY.md` lists a feedback memory whose topic intersects what you're about to do (e.g. `feedback_commit_author.md` when you're about to write a commit), **read the full memory file** before relying on your prior-conversation knowledge of the format. Even if you "remember" the convention from earlier in the session, the recorded memory is canonical — your in-session memory of email formats / trailer wording / identity strings is unreliable.

**Why:** On 2026-05-27 I authored four commits on shader-slang/slang PR #11265 with `Co-authored-by: Harsh Aggarwal <harshaggarwal@users.noreply.github.com>` — wrong. The correct trailer per `feedback_commit_author.md` (set 2026-05-22) is `Co-authored-by: Harsh Aggarwal <[REDACTED-EMAIL]>`. The memory was right; my "recollection" of `harshaggarwal@users.noreply.github.com` was a fabrication. The admin caught it after four commits had already shipped, and I had to filter-branch the entire branch (rewriting 31 commits including upstream master merges) and force-push to fix.

**How to apply:**
- Before the **first commit** of a session that touches a clone, `Read` `feedback_commit_author.md` (or any feedback memory whose name matches "commit", "author", "trailer", "identity"). Don't skip just because the MEMORY.md one-liner hint feels familiar.
- For email addresses, branch-naming conventions, label names, or any fixed-string convention recorded in feedback memory: paste the value verbatim from the memory file into your commit/edit. Don't retype from memory.
- After authoring a stack of commits, before `git push`: run `git log -<N> --format='%h %an <%ae>%n%(trailers:key=Co-authored-by)' <range>` and eyeball every trailer against the feedback file. Easier than rewriting after the fact.

**Recovery if it slipped through anyway:**

```
git filter-branch --msg-filter 'sed "s|<wrong-email>|<right-email>|g"' <merge-base>..HEAD
git push <remote> <branch> --force-with-lease
```

`filter-branch` rewrites commit messages without touching content — safe even on a long branch with many integration commits. The new SHAs propagate; reviewers on the PR get a force-push notification but no behaviour change.

**Cost of the miss:** ~20 minutes of force-push + memory-update work, plus reviewer-trust impact (a force-push on a non-trivial PR for an attribution issue invites scrutiny). Reading the memory at the start would have cost ~30 seconds.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1779895141195-read-auto-memory-feedback-files-before-authoring-c.md`_
