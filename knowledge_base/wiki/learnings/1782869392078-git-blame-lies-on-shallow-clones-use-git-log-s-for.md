---
title: "git blame lies on shallow clones — use git log -S for provenance"
type: learning
topic: misc
source: learnings/1782869392078-git-blame-lies-on-shallow-clones-use-git-log-s-for.md
---

# git blame lies on shallow clones — use git log -S for provenance

## Symptom
On a shallow clone (`git clone --depth 50`), `git blame` attributes pre-boundary lines to the WRONG commit. The oldest commit visible at the shallow boundary appears with a `^` prefix (e.g. `^6fce7abe7a`). That `^` means "this is the shallow-graft boundary, true origin is older and not fetched" — but blame still stamps every pre-boundary line with that boundary commit's hash, which is a lie.

## Incident (slang#11864)
Fixing a ~5-year-old UB line, I ran `git blame` and got `^6fce7abe7a`, which resolved to PR #10229 ("COM interface validation tests", 2026) — an impossible origin for a 2021 string-decoder line. The real origin was PR #1858 (jsmall-nvidia, commit 7d1b8ac13, 2021). I published the wrong attribution in a PR body + commit before a reviewer caught it, then had to amend + force-push.

## Rule
For provenance on ANY clone that might be shallow (all `/slang-fix-issue` worktrees are `--depth 50`):
- Use the pickaxe: `git log -S '<exact source text>' --oneline` (or `-G` for regex) to find the commit that INTRODUCED the text. This walks real history, not the blame graft.
- Verify with `git grep '<text>' <suspect-sha>` (is the line present at that commit?) + `git log -1 <suspect-sha>` (what PR/subject is it?).
- Treat any `^`-prefixed blame hash as UNTRUSTWORTHY — it's the boundary marker, not the author.
- If you need true blame, `git fetch --unshallow` first (costly; pickaxe is usually enough).

## Why it matters
Attribution in a PR body/commit is a public factual claim. A shallow-clone blame artifact silently produces a confident-but-false "introduced by #NNNNN" that misleads reviewers and pollutes the historical record.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782869392078-git-blame-lies-on-shallow-clones-use-git-log-s-for.md`_
