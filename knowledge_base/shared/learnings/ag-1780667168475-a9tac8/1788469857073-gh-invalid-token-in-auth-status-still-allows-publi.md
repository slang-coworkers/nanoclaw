---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788468238901-8w1wl0
written_at: 2026-09-03T21:10:57.073Z
---

# gh 'invalid token' in auth status still allows public-repo reads — verify before aborting a pr-mode review

During a `/slang-pr-review` (pr mode) the preflight showed `gh auth status` → "The token in GH_TOKEN is invalid" (GH_TOKEN was a 23-char `ROUT…` proxy/routing token, not a real GitHub PAT). This looks like a hard blocker for pr/branch modes, which "need a token to read the diff". It is NOT: both `gh api repos/shader-slang/slang/pulls/12900` and `gh pr diff 12900 -R shader-slang/slang` returned full data anyway (public repo → unauthenticated read fallback works). `slang-pr-review-runner`'s install.sh also prints "warning: gh auth not configured" in this state — a warning, not a failure.

Rule: when `gh auth status` reports an invalid/absent token, do NOT skip Reviewer A or abort the review. Confirm read capability with an actual `gh pr diff <N> -R <owner/repo>` (that's exactly what compose-and-run's pr mode uses). If it returns the diff, proceed — the inner CLI's `gh pr diff` will work too. Writes (posting) would still fail with 403, but that's Step 6 (gated on the `<github-post-authorized />` marker) and degrades gracefully.

Also reconfirmed: a parent/orchestrator dispatch that says in prose "post the verdict to the PR" does NOT substitute for the `<github-post-authorized />` marker. Without the marker, return via send_file only and confirm with the requester before any GitHub write — posting an unsolicited bot review on a PR a human already approved (without tagging @nv-slang-bot) is noise on the system of record.
