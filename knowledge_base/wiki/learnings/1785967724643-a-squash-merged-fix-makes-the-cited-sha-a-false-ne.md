---
title: "A squash-merged fix makes the cited SHA a false negative for containment"
type: learning
topic: ci-tooling
source: learnings/1785967724643-a-squash-merged-fix-makes-the-cited-sha-a-false-ne.md
---

# A squash-merged fix makes the cited SHA a false negative for containment

Scrubbing slangpy#274 (bool size on CUDA/Metal), the whole verdict hinged on "is the upstream Slang fix in the version we ship?" The commit everyone cited for shader-slang/slang#7441 was `06a954ec`. Checking containment against it:

```
gh api repos/shader-slang/slang/compare/v2026.12...06a954ec --jq '{status,ahead_by,behind_by}'
# -> {"status":"diverged","ahead_by":1,"behind_by":1537}
```

`diverged` with `merge_base != fix_sha` reads exactly like ABSENT. It would have produced the wrong verdict (issue still blocked upstream). The real reason: `06a954ec` is the **pre-squash** SHA from the PR branch and is not on the repo's reachable history at all — `compare/06a954ec...main` returns **HTTP 404**. That 404 is the tell.

Find what actually landed, by content not by SHA:
```
gh api "search/commits?q=repo:shader-slang/slang+7441" --jq '.items[] | "\(.sha[0:12]) \(.commit.message|split("\n")[0])"'
# -> bdda8a90cdd4 Fix 7441: CUDA boolean vector layout to use 1-byte elements (#7862)
gh api repos/shader-slang/slang/compare/bdda8a90...v2026.12 --jq '{status,behind_by,merge_base:.merge_base_commit.sha}'
# -> {"status":"ahead","behind_by":0,"merge_base":"bdda8a90..."}  => PRESENT
```
`merge_base == fix_sha` && `behind_by == 0` is the containment proof. Note `gh api repos/OWNER/REPO/commits/<sha>/pulls` returned **empty** for the pre-squash SHA, so it is not a reliable way back to the PR either — commit search on the issue number was.

Two bonus traps from the same scrub: the commit *author* ("Harsh Aggarwal (NVIDIA)") differs from the *PR author* (`szihs`), so citing "fixed by X" from one of them can be wrong; and `gh api rate_limit` is unreachable through the OneCLI proxy (`app_not_connected`) while every other endpoint works — don't read that as GitHub access being down.

**Rule:** before concluding a fix is absent from a pinned tag, verify the cited SHA is *on the repo's history* (a 404 from `compare/<sha>...main` means you have a pre-squash SHA). Then re-derive the landed commit by searching for the issue number and test containment against *that*.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785967724643-a-squash-merged-fix-makes-the-cited-sha-a-false-ne.md`_
