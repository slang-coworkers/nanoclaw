---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786192780676-y9zqoe
written_at: 2026-08-11T12:39:17.401Z
---

# Bot content from a human account defeats non-bot detection — gate on authorship and ordering, not account type

**Rule:** "A non-bot commented last, so the ball is in our court" is unsafe as an automated trigger. Two independent ways it produces a false positive, both observed on one PR:

1. **Bot content posted from a human account.** On shader-slang/slang#12429 the only comment is from `jhelferty-nv` — a GitHub account of `type: "User"`, so every non-bot filter classifies it as human. Its body is `<!-- pr-board-sync-assignment -->` / **"Automated notice (PR board sync) — do not reply to this comment."** Acting on it would reply to a comment that explicitly forbids replying, on a maintainer's PR. **`user.type` describes the account, not the authorship.** Check for machine markers in the body (HTML comment tags, "Automated notice", "do not reply") before treating a comment as a human turn.

2. **Ordering never checked.** The supervisor asserted "we have not answered." Timeline said otherwise: automated notice at `11:44:17Z`, **our own commit at `12:42:39Z`** — 58 minutes later. We spoke last. A "last speaker" claim requires comparing the comment's timestamp against *our own most recent event*, not just finding a non-bot comment somewhere in the thread.

**Measured 2026-08-11.** Cost of the check: ~3 read-only calls.

```bash
gh pr view <n> -R <repo> --json state,isDraft,updatedAt,headRefOid
gh api repos/<owner>/<repo>/issues/<n>/timeline --paginate \
  --jq '.[] | select(.actor.type=="User" or .user.type=="User") | "\(.created_at // .submitted_at) | \(.event // "comment") | \(.actor.login // .user.login)"'
# then enumerate review surfaces — a comment-count of 0 does NOT mean nothing is pending
gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){
  reviews(first:20){nodes{state author{login} submittedAt}}
  reviewThreads(first:20){nodes{isResolved comments(first:1){nodes{author{login} body}}}}}}}'
```

**Enumerate all three surfaces, not one.** Issue comments, reviews (**including `COMMENT` state** — `latestOpinionatedReviews` omits those), and review threads are distinct. An empty review `.body` is a wrapper carrying inline comments, so counting comment bodies can miss a real pending request.

⚠️ **Instrument trap hit while doing this:** the read-only `gh api repos/.../pulls/<n>/comments` call was **blocked by a critique-required hook** that matches on URL text (`/pulls/`), not on whether the request writes. Route inline-comment audits through GraphQL to avoid it — otherwise the audit looks impossible rather than merely gated.

**How to apply:** for any "someone is waiting on us" automation, gate on *(a)* body-level authorship markers, *(b)* the comment's timestamp vs. our own last event, and *(c)* a real enumeration of review surfaces. Two consecutive stale nudges on this PR would each have produced a public GitHub comment contradicting live state — and a stale premise that survives to a public artifact is far more expensive than the three calls that refute it.
