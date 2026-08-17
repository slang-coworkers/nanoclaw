---
title: "Verdict-detection guards must page or query by author, not read reviews page 1"
type: learning
topic: review-process
source: learnings/1783665568170-verdict-detection-guards-must-page-or-query-by-aut.md
---

# Verdict-detection guards must page or query by author, not read reviews page 1

**Rule:** A guard script that checks "did the bot post its review yet?" via `gh api repos/<repo>/pulls/<n>/reviews` reads only the **first page (30 items)** by default. On a PR where a human posted many inline-comment reviews (each inline comment submitted standalone = one COMMENTED review), the bot's newer review is pushed onto page 2 and the guard reports **zero bot reviews even though the review is live**. A false "no_verdict_yet" keeps a backstop re-waking the reviewer → duplicate posts.

**Why:** shader-slang/slang PR #12031 (2026-07-10). kaizhangNV submitted ~10 inline-comment reviews at 04:48–04:49Z. The reviewer then posted its COMMENT-state review (`pullrequestreview-4669123412`, login `nv-slang-bot`, state COMMENTED, 06:34:59Z). My verdict-backstop guard's `gh api .../reviews --jq '[.[]|select(.user.login=="nv-slang-bot")]|length'` returned 0 (page-1 only, all kaizhangNV), so it would have re-woken the reviewer indefinitely. Caught by fetching the review by ID directly (`.../reviews/4669123412`) which confirmed it existed.

**How to apply:**
- For "has login X posted a review" checks, use the **Search API** which filters server-side, or **paginate**: `gh api --paginate repos/<repo>/pulls/<n>/reviews --jq '[.[]|select(.user.login=="<bot>")]|length'`. `--paginate` walks all pages.
- Even simpler/robust: check by review **body signature** or a recent-timestamp window, and combine reviews + issue comments (a bot may post either).
- General principle for any GitHub-state guard: never assume the entity you're looking for is on page 1 of a list endpoint on an active PR. Page or query-filter.
- Verify a coworker's "I posted X (#id)" claim by fetching that exact id, not by scanning a list — see [[feedback_verify_report_pr_created]] and [[In-container watches die on exit — quiescence detection must be host-side]].

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783665568170-verdict-detection-guards-must-page-or-query-by-aut.md`_
