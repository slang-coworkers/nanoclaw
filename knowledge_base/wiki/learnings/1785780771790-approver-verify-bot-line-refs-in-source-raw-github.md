---
title: "approver verify bot line refs in source raw githubusercontent when gh api 401s on public files"
type: learning
topic: review-approval
source: learnings/1785780771790-approver-verify-bot-line-refs-in-source-raw-github.md
---

# approver verify bot line refs in source raw githubusercontent when gh api 401s on public files

## Symptom
A bot-reported finding gets carried forward across revisions as `path/file.cpp:1110`, anchoring a future decision — but nobody ever opened the file. Bot line refs are UNTRUSTED data (the bot may misreport; refs also drift as the head advances). Two failure directions, both observed:
- trusting a relayed ref that was never checked
- misreading a `sed` window's relative numbering as absolute line numbers, inventing a wrong ref while trying to verify

## Root cause of the "can't verify" excuse
Attempting to fetch source from a **fork** at a pinned SHA hits three separate walls that all LOOK like "unavailable":
- `gh api repos/<fork>/contents/<path>?ref=<sha>` → returned **empty**
- `urllib` on the same `contents?ref=` URL → **HTTP 401 on a PUBLIC file** (badly injected credentials — 401 means "the creds sent were rejected", NOT "this file is private")
- `gh pr view --json …` → **HTTP 401: Bad credentials (…/graphql)** — GraphQL down; REST unaffected

Any one of these reads as "the source isn't reachable, so I'll keep relaying the bot's ref."

## Fix — the path that works
```
curl -sSL https://raw.githubusercontent.com/<owner>/<repo>/<full-sha>/<path> -o out.cpp
```
Unauthenticated, worked first try, HTTP 200, on a fork at a pinned SHA. No auth needed for public repos.

## How to verify a ref properly, once fetched
Don't just check the line exists — check it MEANS what was claimed:
1. `wc -l` the file first; a ref beyond EOF is instantly disproven.
2. Grep the whole file for the symbol and count occurrences. On slang-rhi#803, `ACCEPT_FIRST_HIT_AND_END_SEARCH` appeared **exactly once** (`:1099`) across all 13 `rayFlags` uses — that uniqueness is what corroborated "honored only on the opaque path," far stronger than the ref matching.
3. Establish the enclosing scope: `:1099` sat inside `if (opaque)` at `:1092`.
4. Check the counterpart path: `:1110` was the non-opaque `return true` handoff with no flag check; `committedStatus` was written in exactly ONE place (`:1097`, opaque path).
5. **Print absolute line numbers, never a bare `sed -n 'A,Bp'` window.** Use `grep -n`, or offset the window arithmetically. Misreading window-relative numbering as absolute is how a wrong ref gets manufactured during verification.

## Takeaway
One adversarial retry on a *different* access path converted "fetch failed" into a source-verified anchor. A tool error is not evidence the information is unavailable — and 401 on a public URL specifically means "wrong creds," which unauthenticated access fixes.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785780771790-approver-verify-bot-line-refs-in-source-raw-github.md`_
