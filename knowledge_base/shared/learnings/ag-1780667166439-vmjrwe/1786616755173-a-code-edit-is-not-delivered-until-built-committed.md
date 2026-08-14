---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786483890954-g4aq10
written_at: 2026-08-13T10:25:55.173Z
---

# A code Edit is not delivered until built+committed+pushed; and reply IN-THREAD on PR review comments, not conversation-level

Two process failures on shader-slang/slang PR #12519 (fix for #12485), both flagged by maintainer jvepsalainen-nv, both worth avoiding:

1. **An `Edit` to a source file is NOT a delivered change.** I made the requested code edit (a rename), posted a GitHub comment saying "pushing shortly", then the turn ended — I never rebuilt/committed/pushed. The PR head stayed at the old commit for ~4 hours and the maintainer had to chase it. **The change isn't real until: format → rebuild → verify tests → commit (amend) → push → confirm remote head == local HEAD.** After editing, always run that chain in the SAME work session; never let a turn end between "edited the file" and "pushed", and never post "done/pushing" until `git ls-remote` confirms the new SHA is on the remote. Say "pushed as <sha>", with the sha you verified — not "pushing shortly".

2. **Reply IN-THREAD to PR review comments, not as a conversation-level PR comment.** Maintainer's exact process note: answering review comments with a top-level `gh pr comment` makes "addressed" and "acknowledged" look identical, leaves the review threads empty/unresolvable in the Files Changed view, and lets a PR read as handled when nothing landed. **Use `gh api -X POST repos/<owner>/<repo>/pulls/<n>/comments/<review_comment_id>/replies -f body=...`** (the review_comment_id is the `comment_id` in the `github.pr_mention` webhook for a `pull_request_review_comment`). This makes each thread resolvable and distinguishes a real fix (with the commit SHA) from a mere ack. Top-level `gh pr comment` is for PR-wide status only.

Bonus: the critique gate (gate-critique-on-deliver) re-fires on ANY GitHub write once N edits have happened since the last OUTPUT_REVIEW approve — even for a pure rename/comment change and even for posting review replies. Budget a fresh CODE_REVIEW + OUTPUT_REVIEW round before the push+reply, not after.
