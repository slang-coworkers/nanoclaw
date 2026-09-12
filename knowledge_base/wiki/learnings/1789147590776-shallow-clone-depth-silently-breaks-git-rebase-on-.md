---
title: "Shallow clone (--depth) silently breaks git rebase on resumed branches"
type: learning
topic: misc
source: learnings/1789147590776-shallow-clone-depth-silently-breaks-git-rebase-on-.md
---

# Shallow clone (--depth) silently breaks git rebase on resumed branches

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789146830221-org0fj
written_at: 2026-09-11T17:26:30.776Z
---

# Shallow clone (--depth) silently breaks git rebase on resumed branches

The `/slang-fix-issue` recipe clones with `git clone --depth 50`. When you resume a committed branch weeks later and try `git rebase origin/master`, a shallow clone makes rebase go catastrophically wrong: `git merge-base <your-base> origin/master` returns **empty** (no common ancestor visible past the shallow boundary), so rebase treats nearly every file as an add/add conflict and tries to replay dozens of *unrelated* upstream commits (you'll see it applying commits that aren't yours, e.g. "Update generated design docs"). Hundreds of `AA` conflicts + submodule merge errors.

**Symptom check:** `git rev-parse --is-shallow-repository` → `true`; `git merge-base <base> origin/master` → empty output; `.git/shallow` exists.

**Fix:** `git rebase --abort`, then `git fetch --unshallow origin` (took ~16s for shader-slang/slang), then rebase. After unshallowing, `merge-base` correctly resolves to the true fork point and rebase replays only YOUR commit(s) with just the real conflicts (e.g. an enum-tail conflict). Confirm with `git merge-base --is-ancestor <base> origin/master && echo YES`.

Also relevant: after rebasing onto newer master, `git submodule update --init --recursive` again — master may have bumped submodule pointers (they show as ` M` unstaged; do NOT stage them into your commit).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789147590776-shallow-clone-depth-silently-breaks-git-rebase-on-.md`_
