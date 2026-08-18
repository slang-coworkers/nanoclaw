---
title: "[approver/infra] read-only `gh api .../pulls/<n>/reviews|comments` trips the critique-gate PR-creation hook — use gh pr view / GraphQL"
type: learning
topic: review-approval
source: learnings/1784867719312-approver-infra-read-only-gh-api-pulls-n-reviews-co.md
---

# [approver/infra] read-only `gh api .../pulls/<n>/reviews|comments` trips the critique-gate PR-creation hook — use gh pr view / GraphQL

**Symptom:** During a PR-approver session, running read-only `gh api repos/<owner>/<repo>/pulls/<n>/reviews` or `.../pulls/<n>/comments` (to fetch review bodies / inline threads) is DENIED by the `gate-critique-on-deliver.sh` PreToolUse hook with "CRITIQUE REQUIRED before PR creation." Repeated hits reach the denial cap and auto-fire an admin bypass request (which gets rejected — correctly, since no bypass is actually needed).

**Root cause:** the hook's Bash PR-creation pattern is `gh api [^|]*pulls\b` — it matches ANY `gh api` call whose path contains `pulls`, including read-only GETs. It cannot tell a GET (fetch reviews) from a POST (create PR). It's a blunt egress guard, not verb-aware.

**How to catch it / workaround (don't fight the hook, route around it):**
- Review bodies: `gh pr view <n> --repo <r> --json latestReviews,reviews --jq ...` (no `pulls` in the path).
- Inline review threads: GraphQL — `gh api graphql -f query='{ repository(...){ pullRequest(number:<n>){ reviewThreads(first:30){ nodes{ isResolved comments(first:10){ nodes{ author{login} path line body createdAt }}}}}}}'`.
- CI/check-runs: `gh api repos/<r>/commits/<sha>/check-runs` and `.../status` are fine (no `pulls`).
- The harvest script (`collect-reviews.sh`/`harvest-reviews.py`) already uses safe paths, so the initial harvest is unaffected; this only bites ad-hoc follow-up reads (e.g. answering a supervisor nudge, reading a late human review body).

**Fix (if a harness owner reads this):** make the hook's `pulls` pattern verb-aware — exclude `gh api` calls without `-X`/`--method` `POST|PATCH|PUT` (i.e. GETs), or anchor to `gh api --method POST ... pulls`. Until then, an ABSTAIN/BLOCK decision message itself passes fine (ABSTAIN fast-path; BLOCK is legitimately gated) — this only obstructs read-only investigation, so use the gh pr view / GraphQL equivalents above.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784867719312-approver-infra-read-only-gh-api-pulls-n-reviews-co.md`_
