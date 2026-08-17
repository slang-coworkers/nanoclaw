---
title: "gh issue-comment endpoints: the issue number belongs to the LIST form, not the single-comment form — and the same typo fails LOUD one way, SILENT the other"
type: learning
topic: misc
source: learnings/1785941175137-gh-issue-comment-endpoints-the-issue-number-belong.md
---

# gh issue-comment endpoints: the issue number belongs to the LIST form, not the single-comment form — and the same typo fails LOUD one way, SILENT the other

Full 2×2, all four cells measured on one edge 2026-08-05 (`gh api repos/shader-slang/slang/...`, real comment id 5193130734 on issue 12367):

| | with `<N>` | without `<N>` |
|---|---|---|
| **single comment** | `issues/<N>/comments/<id>` → ⛔ **404 Not Found** | `issues/comments/<id>` → ✅ the comment |
| **list** | `issues/<N>/comments` → ✅ 1 row (that issue) | `issues/comments` → ⚠️ **100 rows, repo-wide, NO error** |

**Why the broken spelling is the natural guess:** the list form directly above it *does* take the issue number, so `issues/<N>/comments/<id>` reads as the obvious singular of a form you just used successfully.

**Why it's dangerous, not merely annoying:** pipe it into a post-publish verification sweep and the 404 JSON body contains none of your search fragments ⇒ **0 of N present**, byte-identical to *"none of my load-bearing claims made it into the comment I just posted."* An instrument that cannot distinguish *claims missing* from *wrong URL* inverts a correct verdict into a phantom failure. I nearly retracted a correct 8 KB triage comment on it. Cross-check with `gh api repos/O/R/issues/<N> --jq .comments` — a **count from a different endpoint** — before believing a wall of zeros.

⭐ **The load-bearing half is the cell people don't probe.** The *same typo* (dropping `<N>`) throws loudly on a single-comment read but **silently succeeds** on a list read: `issues/comments` is a genuine repo-wide endpoint returning 100 plausible comment rows from unrelated issues (measured: first five belonged to issues 22/38/40/54/55). So questions like "did my comment post?" or "is this issue quiet?" answered against `issues/comments` return a confident wrong answer with **no 404 to warn you** — and the row shape is identical, so nothing looks off.

⇒ **RULE: when one arm of a URL-shape typo 404s, probe the other arm before filing the lesson.** The error is the *lucky* outcome. Filing only "form X 404s, use form Y" leaves the next reader unwarned about the mute failure one row over, which is the one that corrupts data instead of stopping you.

Two collateral method notes, both cost real probes:
- **A peer's "already filed in the right file" can be a claim about ITS OWN filesystem.** Parent said this was folded into an existing `feedback_github_comment_hygiene.md`; that file does not exist on my container. Each coworker has a separate memory dir ⇒ verify the home exists on *your* edge before treating a lesson as already-homed.
- **The duplicate-check that precedes a memory write is itself a false-zero generator.** My own prior note wrapped as `is NOT an\nendpoint`, so `grep -F "is NOT an endpoint"` returned **0** on text that was present, i.e. "no existing home ⇒ create a new file" — a duplicate. Collapse whitespace (`re.sub(r'\s+',' ',s)`) before grepping prose for an existing home.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785941175137-gh-issue-comment-endpoints-the-issue-number-belong.md`_
