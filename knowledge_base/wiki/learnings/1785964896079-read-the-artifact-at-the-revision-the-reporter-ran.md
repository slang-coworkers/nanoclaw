---
title: "Read the artifact at the revision the reporter ran, not the PR head"
type: learning
topic: misc
source: learnings/1785964896079-read-the-artifact-at-the-revision-the-reporter-ran.md
---

# Read the artifact at the revision the reporter ran, not the PR head

When triaging an issue that cites an **open PR or a branch**, the config the reporter actually exercised is the branch state **at the issue's `created_at`** — not the PR's final head. These diverge whenever the PR keeps moving after the report.

Earned on shader-slang/slang#9872 (2026-08-05). Issue filed `2026-02-04T06:19:36Z`; the cited slangpy-samples PR #42 did not merge until **2026-03-06**, with 8 commits landing in between.

- At the **PR head** (`61790cbf4`): `neural-demo.py` has a `--vector-type inline|wave` selector, and `neural-demo-wave.slang` references `TargetEnum` — so it looks like the report may have involved the accelerated cooperative-matrix path.
- At the **filing-time commit** (`0772f98b8`, 02-02): `neural-demo.py:11` **hardcodes** `spy.DeviceType.vulkan`, there is no selector at all, and the loaded shader uses only `InlineVector` + `StructuredBufferStorage` with **zero** `TargetEnum` references.

Same repo, same file, opposite conclusion about which code path the reported comparison covered. Reading the head first (which I did) pointed at the wrong subsystem; the commit-date list is what caught it.

**How to do it:** get the issue's `created_at`, then list the PR's commits with dates and pick the newest one at or before it:

```bash
gh api repos/O/R/issues/N --jq .created_at
gh api repos/O/R/pulls/P/commits --jq '.[] | "\(.sha[0:9]) \(.commit.author.date)"'
curl -s "https://raw.githubusercontent.com/O/R/<that-sha>/<path>" -o /tmp/f
```

For the corresponding main-repo state, `git log -1 --format=%H --before=<issue created_at> master`.

**Generalizes:** a claim about "what the reporter saw" is a claim about an artifact **at a timestamp**. A path that exists today may have been added after the report (here, a `static_assert` and its pinned diagnostic test both landed ~4 months later — citing them as the explanation would be an anachronism), and a path they used may since have been deleted (the file holding the divergence was removed by a later migration that carried the pattern forward under a new name). Neither shows up if you only read HEAD.

**Corollary on `git log -S` for "when was this introduced":** it can land on the commit that **added the file** rather than the one that introduced the symbol. Control it with a must-miss probe on the parent — if `git show <sha>^:<path>` errors with the path absent, that commit created the file and the symbol may well predate it elsewhere.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785964896079-read-the-artifact-at-the-revision-the-reporter-ran.md`_
