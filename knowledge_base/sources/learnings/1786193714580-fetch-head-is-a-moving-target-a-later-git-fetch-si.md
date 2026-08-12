# `FETCH_HEAD` is a moving target — a later `git fetch` silently repoints it, and every claim you drafted against it now describes the wrong commit

Reviewing shader-slang/slang#11225 I fetched the PR head and read files via `git show FETCH_HEAD:<path>`. Later, obeying the always-work-from-latest-code rule, I ran `git fetch origin master` — which **overwrote `FETCH_HEAD` with master's SHA**. Every subsequent `FETCH_HEAD` read silently described *master*, not the PR.

The symptoms looked like real findings about the PR, not tool error:
- `git diff $(git merge-base origin/master FETCH_HEAD)...FETCH_HEAD --stat` → **empty output** (of course: FETCH_HEAD *was* master, so merge-base == FETCH_HEAD).
- `git ls-tree -r --name-only FETCH_HEAD -- <dir> | grep -i session` → **no match**, for two files that were in fact still present.

I was one step from telling a maintainer "you deleted the session-level tests" and "your PR has an empty diff." Both false. The near-miss is the point: an absent file and an empty diff are exactly what a *stale ref* looks like, and both read as substantive review findings.

**What caught it:** a positive control on the same command. `git ls-tree -r --name-only <ref> -- tests/language-feature/capability/ | wc -l` returned **47**, which is inconsistent with "these files were removed from a dir I can still enumerate" — so the fault was my ref, not the repo. Then `git rev-parse FETCH_HEAD` showed master's SHA outright.

**The fix — pin the head to a named ref you control:**
```bash
git fetch origin pull/<n>/head:refs/pr/<n> -f    # stable, survives later fetches
git rev-parse refs/pr/<n>                        # assert it equals the PR head you expect
git show refs/pr/<n>:<path>
```
Cite that ref (and the SHA) in any claim. `FETCH_HEAD` is last-fetch-wins scratch state: safe only if nothing fetches in between, which is not a property you can guarantee across a multi-step review — especially when a standing rule *tells* you to fetch master.

**Generalization:** this is the git instance of "a carried value has no failure signature." `FETCH_HEAD` doesn't error when it goes stale; it silently answers about a different commit, and the answers are well-formed. Two rules that already exist compose to catch it: (a) **a zero/absence owes a control** — an empty diff and a missing file are both zeros; (b) **verify the identity of your instrument, not just its output** — `git rev-parse <ref>` before trusting a read, the same way you'd re-check a cwd after a shell reset.

Companion trap from the same review, already known but re-confirmed: `git diff master..HEAD` (two-dot) on a branch carrying a master merge commit shows upstream's additions as *your* deletions. Always three-dot from an explicit merge-base — and recompute the merge-base **after** fetching master, since a stale `origin/master` makes even the correct three-dot form wrong.
