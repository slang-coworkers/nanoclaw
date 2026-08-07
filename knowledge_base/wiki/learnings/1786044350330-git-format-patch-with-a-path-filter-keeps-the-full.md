---
title: "git format-patch with a path filter keeps the full commit message"
type: learning
topic: misc
source: learnings/1786044350330-git-format-patch-with-a-path-filter-keeps-the-full.md
---

# git format-patch with a path filter keeps the full commit message

# `git format-patch -1 -- <path>` filters the DIFF but keeps the WHOLE commit message

**Observed** 2026-08-06, splitting one file out of a commit on shader-slang/slang#12401. The bot's
GitHub App lacked `workflows` permission, so a 6-line `.github/workflows/*.yml` step had to ship as a
standalone patch. `git format-patch -1 -- .github/workflows/ci-slang-test.yml` produced a patch whose
diff was correctly narrowed to `1 file changed, 6 insertions(+)` — carrying the **entire original
commit message**, which described the prelude rewrite, the aliasing argument, a 33-kernel PTX sweep,
and "adds an offline-nvcc fixture." None of that was in the diff.

**The hazard is not cosmetic.** The inherited subject was
`Fix shader-slang/slang#12401: spell CUDA vector components directly...`. `Fix <owner>/<repo>#<num>`
is a GitHub **auto-close** reference in the fully-qualified form, so merging this 6-line CI-only
commit would have closed #12401 while the actual prelude change sat unmerged on a draft branch.

**How to apply:**
- After any `format-patch`/`cherry-pick`/`rebase` that narrows a commit **by path**, rewrite the
  message to describe what the diff now contains. The path filter has no effect on the message.
- On a split-out companion commit, use `Refs #N` — never `Fix`/`Fixes`/`Closes`. Only the commit
  carrying the substantive change gets the closing keyword.
- **Read the patch header, not just the diffstat.** This defect is invisible to a diffstat check
  (the hunk was correct all along) and invisible to `git am` (rc=0, applies clean). The artifact is
  valid; only the prose lies. Cheapest detector: `grep -iE '^(Subject|.*\b(Fix(es|ed)?|Close[sd]?|Resolve[sd]?)\b)' <patch>`
  and confirm every issue reference is intended.
- Generalizes: a command whose *success* is real and whose *metadata* is stale has no failure
  signature. Verify the description against the payload whenever a tool subsets a composite object.


## See also

Same session, same root cause, split by *detector* rather than cause:
- `1786042764028-git-rm-cached-while-amending-stages-a-full-file-de.md` — the sibling trap, which **is** caught by reading the diffstat.
- `1786044389931-git-commands-whose-filter-narrows-the-diff-but-not.md` — the unified writeup, which additionally carries the **pristine-apply verification procedure** and the `$?`-after-a-pipe / `PIPESTATUS` caveat.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786044350330-git-format-patch-with-a-path-filter-keeps-the-full.md`_
