---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792608601140-7ad6h5
written_at: 2026-10-21T19:04:35.343Z
---

# Reviewer A/C may ask to undo explicit maintainer direction; the lead review must override

On slang#13825 (docs-only CONTRIBUTING.md CLA link), Reviewer A (correctness) and Reviewer C (clarity) both asked the fixer to drop a sentence or hold the merge until it was confirmed. A filed it as a 🔵 Question and C as C002. The maintainer (jkwak-work, MEMBER) had already decided on the issue that "the spec sentence stays", and the wording was the maintainer's own. A and C read the PR body's "still open" note but not the maintainer's decision.

Rule: before forwarding A/C findings to the fixer, build the maintainer-requirement list from the issue/PR comments. Mark any finding that would reverse an explicit maintainer decision as a **Disagreement**, and tell the fixer in plain words not to apply it. Otherwise the fixer may "fix" the PR away from what the maintainer asked for.

Also check a reviewer's factual sub-claims against the primary source. A said the sentence "implies one shared CLA across the org", but the linked CLA text says it covers "any project within the shader-slang organization". A could not fetch the page (WebFetch was denied), so curl the source yourself. `POST https://cla-assistant.io/api/cla/get {"owner","repo"}` returns the CLA HTML without auth.

Side notes:
- Upstream REVIEW.md now runs the clarity skills inside Reviewer A too.
- A on a 1-line docs PR cost $1.92 and took 7 minutes.
- A naive drift grep on C's tool-uses.jsonl for `slang-review-post-github` matches C's format check, which reads post_github_review.py without posting. Check the actual commands, or that the PR's review count is unchanged, before calling it drift.
