---
name: feedback_a_mirrored_source_that_became_a_repo_can_smuggle_a_gitlink
description: "TRIGGER: a mirror step (cp -rL / rm -rf + cp) whose SOURCE has since become a git repo. cp copies .git/; whether git then writes a 160000 gitlink depends on whether the files were ALREADY TRACKED — measured both regimes. The nightly kb-sync script has no rm -rf of the nested .git."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f718bcd5-cc7a-40c4-8837-f84182cdad33
---

The nightly `knowledge_base` sync mirrors four live sources with `rm -rf <dest>; cp -rL <src>/. <dest>/`.
On 2026-08-09 one of those sources —
`/home/node/.claude/projects/-workspace-agent/memory/` — **has been a git repo since
2026-08-05** (`bbae25a` "Baseline snapshot of Main's memory store"), so `cp -rL` faithfully
copied its `.git/` (784 objects, 7.6M) into `knowledge_base/auto-memory/.git/`.
The task script has **no step that removes it**. I removed it before staging.

**Why it matters — and the part I got wrong.** My first instinct was "a nested `.git` becomes a
submodule gitlink and clones silently lose the content." That is true in only one of two regimes,
and this store was in the *other* one:

| control | setup | `git add -A` result |
|---|---|---|
| `gtest` | plain dir named `.git` (not a repo) | files inside **never staged**, even with `git add -f` |
| `gtest2` | fresh nested repo, parent path **untracked** | `:000000 160000 … A kb/auto-memory` — **gitlink** ⚠️ |
| `gtest3` | nested repo appears over **already-tracked** files | normal `M`/`A` blobs, **no gitlink**, 0 deletions |

`knowledge_base/auto-memory/` has been tracked since long before 08-05, so it was `gtest3`-shaped.
⭐⭐**Corroborating evidence I should have looked for BEFORE inventing the hazard: the four syncs
08-05…08-08 all carry `0` `.git/` paths and `0` mode-160000 entries in tree** (`git ls-tree -r
<sha> knowledge_base/auto-memory | awk '$1=="160000"'` → empty at `822159170`), i.e. the nested
repo had already coexisted with four successful syncs. The leak never happened and, in this regime,
would not have.

⛔**I published the invented framing before checking it.** PR #1148's body says the source
*"became a git repo upstream since the last sync"* — false; it became one four days and four syncs
earlier. The remediation ("excluded from the snapshot") is accurate, the novelty claim is not.
⇒ ⭐⭐⭐**A hazard I removed is a hazard I never observed. Before writing a risk into a durable
artifact, ask what the LAST FEW RUNS of the same pipeline already show** — four merged trees were
one `ls-tree` away and they answered it.

**How to apply:**
- Keep the `rm -rf knowledge_base/auto-memory/.git` step — cheap, and it makes the outcome
  independent of which regime you are in. But describe it as *belt-and-braces*, not as fixing an
  observed leak.
- **The regime is decided by whether the parent path is already tracked**, not by the presence of
  `.git`. Determine it with `git ls-tree -r --name-only HEAD <dest> | wc -l` before reasoning.
- ✅Post-merge integrity check that covers both regimes at once, on the *merged* tree (not the
  working copy): `git ls-tree -r origin/<branch> <dir> | awk '$1=="160000"'` (must be empty) **and**
  `git ls-tree -r --name-only origin/<branch> <dir> | grep -c '/\.git/'` (must be 0). Verified empty/0
  for `6c93d3814`.
- ⚠️**Reconcile the mirror count against the tree count and explain every unit of the gap.**
  12592 local vs 12591 in tree resolved to one intentionally-ignored `.pyc`
  (`.gitignore:51 knowledge_base/**/__pycache__/`) via `git check-ignore -v` — a one-file gap is
  exactly the size that gets waved through, and waving it through is how a real omission hides.

Related: [[project_nanoclaw_kb_sync_pr_autoref_noop]] (these PRs auto-merge in seconds and have no
approver), [[feedback_nv_coworkers_automerge]] (the standing authority this runs under),
[[feedback_a_control_built_from_the_matchers_own_assumption_is_blind]] (same pipeline, the
extension-vs-shebang census defect).
