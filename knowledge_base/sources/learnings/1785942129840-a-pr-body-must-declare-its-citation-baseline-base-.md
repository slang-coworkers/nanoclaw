# A PR body must declare its citation baseline — base-vs-branch line offsets caused four false corrections in one review

## The failure mode

A PR description cites `file.cpp:NNN`. The author measured `NNN` against the **merge base**; a reviewer
checks it against the **branch** (or against a *moved* master) and finds different code there. The
reviewer reports a wrong citation. The citation was right — for a ref nobody stated.

On shader-slang/slang#12353 this happened **four times in one review cycle**, and cost more messages
than any real defect in the change:

| Cited | Author's ref | Reviewer's ref | Delta |
|---|---|---|---|
| `slang-diagnostics.lua:276` | base 276 | branch 283 | +7 |
| `slang-emit.cpp:3593` | base 3593 | branch 3608 | +15 |
| `slang-diagnostics.lua:465-466` (99996 note) | base/master 465 | branch 472 | +7 |
| `slang-diagnostics.lua:6154` (hard `error()`) | base 6154 | **author wrote branch 6161** | +7 |

Note the last row: the author leaked a *branch* number into base-relative prose, copied out of a build
log. So the confusion runs both directions.

## Fixes, in order of leverage

1. **Declare the baseline in the body, once, at the top.** This is the root cause — none of the
   corrections would have been filed if the ref were stated:
   > *Line numbers are relative to this PR's merge base `<sha>` — the code as it reads before the patch.
   > Verify with `git show <sha>:<path>`, not a branch checkout: lines below an insertion appear shifted
   > (net `a.cpp` +15, `b.lua` +7). Pre-existing lines in untouched files are cited by symbol instead.*
2. **Cite pre-existing lines in files the PR does NOT touch by CONTENT, never by line.** A symbol name
   plus quoted comment text is immune to every offset, including a future rebase or an unrelated commit:
   ```
   `standalone_note("note-failed-to-load-dynamic-library", 99996, ...)`, whose comment records
   "moved from 99999 to avoid severity conflict with internal-severity diagnostics at that code."
   ```
   Don't "fix" such a citation to the branch number — branch numbering is the *most* ephemeral of the
   three candidates, and on a squash-merge repo it's embedded permanently in the commit message.
3. **Compute the per-file offsets, don't estimate them.** `git diff --numstat <base>..HEAD -- <path>`;
   net = added − deleted. I first wrote +14 for a file that was +15 (`+17/−2`), caught by checking a
   citation below the insertion (3593 → 3608).

## ⭐ The checker must record which ref it ran against

A citation-validating script passes 15/15 against whatever tree it happens to run in — so the pass is
**unfalsifiable** unless it names the ref. Making it ref-aware immediately surfaced the author's own
leaked branch number:

```python
BASE = 'ca76f8781a'                      # declare it, print it, put it in the report
lines = subprocess.run(['git','show',f'{BASE}:{path}'],capture_output=True,text=True).stdout.split('\n')
if cited_line > len(lines): print(f"OUT OF RANGE {path}:{cited_line}")
...
print(f"PREDICATE RAN AGAINST REF: {BASE}")
```

Same shape as any other instrument that formats output identically whether or not it measured the right
thing. "17/17 clean" means nothing without "…against `<sha>`".

## Also: check whether master moved

`master` is not a fixed point. Mid-review it advanced 6 commits, so "master" and the merge base became
different trees — a third candidate ref for the same citation. The merge base
(`git merge-base HEAD origin/master`) is the stable one and the right thing to declare, because it is
what the diff is computed against.
