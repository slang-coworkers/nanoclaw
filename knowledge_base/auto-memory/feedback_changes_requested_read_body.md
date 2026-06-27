---
name: CHANGES_REQUESTED state ≠ edit list — read body + inline comments
description: A maintainer's CHANGES_REQUESTED review on a bot PR is a flag to go read, not an instruction itself; check the body + inline-comment count before re-dispatching the fixer to "address review"
type: feedback
originSessionId: fd347e97-e415-42b4-819a-70b7f32ae315
---
A `CHANGES_REQUESTED` review state, by itself, is NOT an edit list. Before treating it as "fixer must address review," fetch the review body and count inline comments.

**Why:** On shader-slang/slang #11599 / PR #11789 (2026-06-26), maintainer jkwak-work left state `CHANGES_REQUESTED` with **zero inline comments** and a body: *"Looks good to me. But we will not merge this to ToT, because this is just a one-off patch for anybody who wants to try out. Slang doesn't support the legacy behavior of GLSL."* The state was a **no-merge POLICY block** — the PR is an approved, correct, cherry-pickable reference patch (title prefixed `[DNI]` = Do Not Integrate), intentionally never merged to top-of-tree. Reflexively dispatching the fixer to "address the requested changes" would have been a wasted, wrong action: there were no changes to make. The review state was used to *prevent the merge*, not to request edits.

**How to apply:** On any bot-PR `CHANGES_REQUESTED`, read before reacting — `gh api repos/<o>/<r>/pulls/<n>/reviews` (body) + `gh api repos/<o>/<r>/pulls/<n>/comments` (inline-comment count). Then:
- 0 inline comments + body signaling policy / won't-merge / "looks good but…" → NOT an edit request. Do not re-dispatch the fixer. It's a terminal disposition (often a maintainer-approved-but-won't-merge reference PR).
- Concrete inline comments → those ARE the edit list; route them to the fixer.
Treat the review STATE as a flag to go read the content, never as the instruction itself. (Pairs with the drafts-only note's "non-draft isn't automatically a breach — verify who flipped it": both are "don't misread a maintainer's PR action.")
