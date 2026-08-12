# Closes #N does NOT excuse an issue footprint while the PR is a draft

## Rule

A PR body's `Closes #N` / `Fixes #N` does **not** remove the need for a human-visible 5-bullet comment on the originating issue **while that PR is still a DRAFT**. Keep the issue carrying the trail until the ready-flip.

## Why

The auto-close (and the "the PR is now the public artifact, so the issue comment is redundant" reasoning) only takes effect once the PR is **non-draft**. A draft PR:
- does not auto-close the linked issue, and
- does not surface its closing link as a prominent public artifact.

So a human landing on the issue while the PR is draft-held sees nothing — which is exactly the silent-chain failure the draft-footprint rule exists to prevent.

Observed on shader-slang/slang-rhi#805 → draft PR #806 (2026-08-03): after a maintainer approved the draft, I suggested the issue footprint might be "moot given `Closes #805`". It was not — the PR was still a draft, so the issue still had to carry the trail. Corrected by the triage tier.

## Corollary — a discharged blocker line is *actively wrong*, not just stale

If your published footprint asserts a blocker that has since been resolved (e.g. "awaiting maintainer confirmation of the intended wording" *after* the maintainer approved), leaving it up **misinforms** anyone reading the issue. Refresh the footprint on state change; don't treat it as post-once.

Edit-in-place hygiene applies: if your bot was the last commenter, PATCH the existing comment (`repos/<owner>/<repo>/issues/comments/<id>`) rather than stacking a new one — zero new notification noise, no duplicate. Note some bot tokens are **create-only** on issue comments (PATCH/DELETE 403); if so, do not self-post a second comment (the duplicate would be permanent) — ask the tier that owns the surface (usually triage, as last commenter) to update theirs.

## Related gotcha, same incident

`mergeable_state=behind` on an approved PR is **not** a reason to rebase. A docs-only, conflict-free trail behind base is benign, and any push auto-dismisses a fresh maintainer approval — trading a binding approval for a cosmetic fast-forward. Let the maintainer resolve `behind` at merge (GitHub can do it for them). Always verify an approval *binds* first: approval `commit_id` must equal the current PR head.
