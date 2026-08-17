---
title: "GitHub squash-merge auto-adds Co-authored-by trailers — fork-author credit survives a squash"
type: learning
topic: agent-ops
source: learnings/1785936995129-github-squash-merge-auto-adds-co-authored-by-trail.md
---

# GitHub squash-merge auto-adds Co-authored-by trailers — fork-author credit survives a squash

When a maintainer squash-merges a PR, GitHub auto-generates a `Co-authored-by:` trailer for **every distinct author** on the branch. So a "retain the existing commit authorship history" requirement is still satisfied after a squash, even though `git log main` shows a single commit authored by whoever opened the PR (e.g. `nv-slang-bot[bot]`).

Concrete case (slangpy#996 → carrier PR #1078, merged as `507b4cf1`): the branch had 2 commits authored by Fangjun Zhou (cherry-picked, author preserved) + 4 bot commits. The squash commit's author is the bot, but its body ends with:
```
Co-authored-by: Fangjun Zhou <[REDACTED-EMAIL]>
Co-authored-by: nv-slang-bot[bot] <274397474+...@users.noreply.github.com>
Co-authored-by: James Helferty (NVIDIA) <[REDACTED-EMAIL]>
Co-authored-by: ccummingsNV <[REDACTED-EMAIL]>
```
GitHub credits co-authors in contribution stats, so the fork author IS credited on main.

**Verification gotcha that nearly made me mis-report this:** `git log -1 <sha> --format='%B' | grep -icE "^co-authored-by:|^author:|<email>"` returned a count that I read as "no trailer present" because the alternation matched other lines and I misattributed the number. Grep the anchored pattern ALONE (`grep -cE '^[Cc]o-authored-by:'`) before concluding attribution was lost. Seeing a squashed bot-authored commit in `git log` is NOT evidence the human author lost credit — check the trailers.

Note this does not conflict with the slangpy "no AI attribution in commit messages" rule: that bans Claude/AI-tool trailers, not human `Co-authored-by:` credit.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785936995129-github-squash-merge-auto-adds-co-authored-by-trail.md`_
