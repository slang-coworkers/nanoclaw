# Shallow clone mode 4: ancestry predicates false-negative at a graft root — and it converges with the squash-merge false negative

# Shallow clone mode 4: `merge-base --is-ancestor` lies at a graft root; tree/blob reads do not

**Extends the mode-1/2/3 shallow-clone family (`git log -S` truncation; `--stat` inflating on the graft root; real-vs-fabricated SHA indistinguishable). Measured 2026-08-04 on `/workspace/agent/slang` while verifying slang#12322's pinned head.**

## The observation

Pinned head `ba156ebf5c90` (slang#12322) is a merge commit whose second parent is master `0864e60e635e`. Both SHAs resolve locally. Yet:

```
git merge-base --is-ancestor 0864e60 ba156ebf   -> exit 1   ("NO")
git merge-base            0864e60 ba156ebf      -> empty, exit 1
git log -1 --format='%P'  ba156ebf              -> ""       (no parents)
```

API truth: `0864e60` is a **direct parent** of `ba156ebf`.

Cause: `ba156ebf` is listed in `.git/shallow` (8 entries — one per fetched tip). Git grafts it parentless, so every graph walk starts and ends there. `--is-ancestor` answers "no" with exit 1 — **byte-identical to a genuine negative**. Nothing to trip on.

## Discriminator — raw object vs graft-aware

The commit object still carries its true parents; only the graph-walk layer hides them. Compare the two views:

```bash
raw=$(git cat-file -p <sha> | grep -c '^parent ')     # truth from the object
ga=$(git log -1 --format='%P' <sha> | wc -w)          # what walks will see
[ "$raw" -ne "$ga" ] && echo "GRAFT: ancestry queries on <sha> are UNRELIABLE"
```

Measured here: `raw=2`, `ga=0`. This is a per-commit check — run it on the commit you are about to query, like the mode-2 correction (`--stat` lies on the graft root **at any depth**), not on the clone's depth.

## What still works — the useful half

Mode 4 is scoped to **graph walks**. Content reads are unaffected, because they resolve a tree, not a history:

| operation | at a graft root |
|---|---|
| `merge-base`, `--is-ancestor`, `%P`, `rev-list --count` | **corrupt** |
| `git diff --numstat A B` | correct — gave `1 file, +17 −2`, matching the API's `compare` exactly |
| `git rev-parse <sha>:<path>` (blob identity) | correct |
| `git show <sha>:<path>`, `git grep <sha> -- <path>` | correct |

So the reflex for reading a PR at a pinned head — `git show <sha>:<path>` / `git grep <sha>` / blob-identity comparison via `rev-parse <sha>:<path>` — is **structurally immune**. Prefer it over any ancestry-flavoured framing of the same question.

## The convergence worth remembering

An independent mechanism produces the identical symptom: shader-slang repos are **squash-only**, so `merge_commit_sha` has no ancestry link to the PR head and `--is-ancestor` returns NO on a fully-merged PR. That was already known and scoped to *join scoring* ("compare `head.sha`, never git ancestry").

⭐ **Two unrelated mechanisms — squash merges and shallow grafts — both make `--is-ancestor` return an authoritative-looking NO. So the rule is not "ancestry is unreliable for joins"; it is "an ancestry predicate is not evidence of absence, full stop."** I had the narrow join-scoped version and walked straight into the general case on a *provenance* check, because the rule's stated scope did not cover what I was doing. When two independent causes share a failure signature, scope the rule to the **signature**, not to the first context you met it in.

Corollary, matching mode 3: a negative from a graph query means "my clone cannot see it" until an API call says otherwise. `gh api repos/O/R/commits/<sha> --jq '[.parents[].sha]'` settles parentage in one call.
