---
author_agent_group: operator
author_session: operator-2026-10-14
written_at: 2026-10-14T07:51:13.000Z
---

# CORRECTION: Devin Review renders for anonymous viewers, drafts included — never skip Reviewer B for a draft PR; the timeouts were a fetch-script defect, fixed 2026-10-13

**Supersedes** `1791418496634-devin-review-never-finishes-on-a-draft-pr-viewed-a` (2026-10-08), which blamed draft PRs viewed anonymously for Reviewer B's 30-minute timeouts and told reviewers to skip B after one timeout on a draft. That diagnosis was wrong.

**What was verified (2026-10-13, prod reviewer container and the lego instance).** `app.devin.ai/review/<owner>/<repo>/pull/<n>` renders fully for anonymous viewers, draft PRs included: shader-slang/slang#13401 (draft) and #13583 (draft) both showed the sidebar counts and findings. Reviewer B had failed on every PR since 2026-09-17 (0 of 64 in October) for two reasons inside `devin-fetch.sh`'s done-check, neither related to draft status:

1. Devin renamed the panel heading from "Devin's AI analysis" to "Devin's analysis" on 2026-09-17, so the heading signal never matched.
2. The first anonymous visit to a PR page is what starts Devin's analysis (6–11 minutes on the PRs measured). When it finishes while the page is open, the sidebar shows "Analysis complete" plus a "View results" button and the "N Bugs / N Flags" counts render only after that button is clicked, so the summary signal never appeared either.

**Fix.** shader-slang/slang-skills #62 (merged; on prod since 2026-10-13 10:35 UTC, kept current by the hourly refresh-skills cron): both heading spellings, the "View results" click, "Analysis complete" and the new Vulnerabilities category as done-signals, one reload before expanding, fence-safe extraction. Verified on prod: slang#13401 exit 0 in 58 s with its one Flag; slang#13583 exit 0 in 59 s with 1 Bug and 2 Flags.

**Rule now.**
- Run Reviewer B once per review, in the background, with the 15-minute cap the `/slang-pr-review` workflow sets. Never consult `isDraft` to decide whether to run or skip B, and never retry B within the review.
- If `devin-fetch.sh` exits 3, read `devin-error.txt`: it records `heading`, `summary`, `analysis_complete`, `view_results` and `in_progress` plus the page text in `devin-page.txt`. A fully rendered page with a false done-signal means the fetch script's selectors are stale again: report that upstream (slang-skills) and mark B skipped for this review. It is never a property of the PR.
- Exit 2 is an auth wall and exit 4 a transient Chrome launch failure; both are also "skipped", not "Devin does not work on this kind of PR".
