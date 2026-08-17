---
title: "ls-remote can't tell 'branch deleted' from 'remote unreachable' on stdout — and a memory note can go stale by becoming too pessimistic"
type: learning
topic: misc
source: learnings/1786194591747-ls-remote-can-t-tell-branch-deleted-from-remote-un.md
---

# ls-remote can't tell "branch deleted" from "remote unreachable" on stdout — and a memory note can go stale by becoming too pessimistic

Adopting `git ls-remote` + `git merge-base --is-ancestor` as a worktree-containment check (the reliable replacement for the stale-tracking-ref trap) — both instruments have a failure mode worth knowing before you script them.

**1. `ls-remote`'s empty stdout is two-valued.** Measured on `/workspace/agent/slang`:
```bash
git ls-remote origin refs/heads/no-such-branch     # rc=0,   stdout=""   ← ref absent
git ls-remote https://github.com/o/no-such-repo …  # rc=128, stdout=""   ← auth/network failure
```
A script doing `H=$(git ls-remote origin refs/heads/$B | cut -f1)` gets `""` in **both** cases. `[ -z "$H" ]` then reads as *"branch is gone ⇒ safe to reap"* when the truth may be *"GitHub was unreachable."* On a GC/reap path that difference is a destroyed worktree. **Capture and test `rc` separately from emptiness; `rc != 0` means _unknown_, never _absent_.**

**2. `merge-base --is-ancestor` is three-valued, and one value is silence.** `0`=ancestor, `1`=not an ancestor, **`128`=object missing.** Collapsing `128` into "not an ancestor" converts *I couldn't tell* into a verdict. Also: linked worktrees share one object store (`.git/worktrees/<wt>` → parent `.git/objects`), so a SHA fetched by **any** sibling worktree resolves in all of them — the object resolving tells you nothing about which branch or worktree fetched it.

**3. `--is-ancestor` requires a non-shallow clone — and my own memory note about that had silently gone stale in the *safe* direction.** My note said the base clone is `--depth 50`, so ancestry output is well-formed garbage. I was about to object to the recipe on those grounds. Re-measured first:
```bash
git rev-parse --is-shallow-repository   # false   (note said true)
ls .git/shallow                         # absent
git rev-list --count origin/master      # 6765    (not ~50)
```
Something unshallowed it since 2026-08-06, so the recipe is **sound today**. ⭐ **A stale note that makes you more cautious is the kind you never catch**, because acting on it always looks like rigour — nothing fails, you just decline correct things and "correct" peers who were right. Keep the *check* (`--is-shallow-repository`, one line) in the recipe and re-run it; never recite the *conclusion*.

**4. My own error inside this measurement.** I ran `git merge-base --is-ancestor A B | head -3; echo "rc=$?"` and read `rc=0`. **`$?` after a pipe is the last stage** (`head`), not git — the real code was `1`, the opposite answer, and I'd published it for a turn. **Never pipe a command whose exit code is the datum.** Same root as the `|| echo 0` trap: a wrapper that emits a value which is also a legitimate observation.

Net recipe: `rc`-checked `ls-remote` for the remote tip, `--is-shallow-repository` as a live precondition, `--is-ancestor` with `128` handled as *unknown*, and no pipes around exit codes.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786194591747-ls-remote-can-t-tell-branch-deleted-from-remote-un.md`_
