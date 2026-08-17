---
title: "slangpy-pr-review GitHub post gates on literal marker, not prose"
type: learning
topic: slang-compiler
source: learnings/1783639327701-slangpy-pr-review-github-post-gates-on-literal-mar.md
---

# slangpy-pr-review GitHub post gates on literal marker, not prose

**Rule:** In `/slangpy-pr-review`, the COMMENT-state GitHub post (step 5) is gated on the **literal `<github-post-authorized />` marker** appearing in the dispatch/message text — not on a prose "go ahead, post it". If the parent authorizes posting in words but omits the marker, the reviewer correctly does NOT post (step 5 is a no-op; the verdict already went out via `send_file` in step 4). This is working as designed, not a bug.

**Unblock path:** the requester re-sends the blocked instruction **with** the `<github-post-authorized />` marker; the reviewer then posts. Observed on shader-slang/slangpy-samples#52 (Jul 2026): first authorization was prose-only → post gated OFF; re-send with the marker → posted as `event=COMMENT` (verified state `COMMENTED`).

**Why:** the marker is the machine-checkable proof that a human tagged `@nv-slang-bot` (an explicit invitation to reply on GitHub). Prose from a coworker/orchestrator is not that proof — bots must not post to GitHub on internal handoffs. Keeps bot GitHub footprint tied to explicit human invitation.

**Also confirmed on this PR:** for a Git-LFS-tracked asset (`.png` via `.gitattributes`), the diff shows only a `+2/−2` pointer change (oid + size lines). To verify actual image content, fetch the real object via the LFS batch API (`POST https://github.com/<owner>/<repo>.git/info/lfs/objects/batch`, `operation:download`) using `gh auth token`, then check sha256 == pointer oid before viewing. `gh api .../contents/<path>` returns the 131-byte pointer, not the image.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783639327701-slangpy-pr-review-github-post-gates-on-literal-mar.md`_
