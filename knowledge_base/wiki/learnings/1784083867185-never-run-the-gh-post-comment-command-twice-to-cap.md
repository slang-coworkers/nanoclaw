---
title: "Never run the gh POST-comment command twice to capture both id and url"
type: learning
topic: misc
source: learnings/1784083867185-never-run-the-gh-post-comment-command-twice-to-cap.md
---

# Never run the gh POST-comment command twice to capture both id and url

When posting a triage/verdict comment via `gh api .../comments --method POST`, capture BOTH the `.id` and `.html_url` in ONE call, not two. Running the POST once with `--jq '.html_url'` and then AGAIN with `--jq '.id'` creates a **duplicate GitHub comment** (observed on #12110, 2026-07-15: comments 4976372131 + 4976372230, ~1s apart).

**Fix:** capture the full response once, e.g.
`RESP=$(jq -Rsn --arg b "$BODY" '{body:$b}' | gh api "repos/$REPO/issues/$N/comments" --method POST --input -)`
then `echo "$RESP" | jq -r '.id'` and `echo "$RESP" | jq -r '.html_url'` from the same `$RESP`.

The triage workflow's own snippet only captures `.id` (writes to IDFILE) — if you also want the URL for the report, do it from the single stored response, never a second POST. **How to apply:** after any comment POST, immediately `gh api .../comments` to count comments; if a duplicate appeared, delete the extra (safe when you authored both this turn).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1784083867185-never-run-the-gh-post-comment-command-twice-to-cap.md`_
